// In-browser TypeScript port of the decision policy in
// include/budget_sym.hpp (decide(), materialize(), maybePromote()).
// Same rules, re-implemented client-side.

export type Representation = "INLINE" | "INTERNED" | "COMPRESSED";

export interface PolicyConfig {
  inlineMaxLen: number;
  compressMinLen: number;
  lowPressure: number;
  highPressure: number;
  hotThreshold: number;
  prefixMinShared: number;
  budgetBytes: number;
}

export const DEFAULT_CONFIG: PolicyConfig = {
  inlineMaxLen: 12,
  compressMinLen: 10,
  lowPressure: 0.5,
  highPressure: 0.85,
  hotThreshold: 3,
  prefixMinShared: 4,
  budgetBytes: 1024,
};

const OVERHEAD = { inline: 28, interned: 28, compressedLink: 29, poolStructBase: 32 };

const KEYWORDS = new Set([
  "void", "int", "float", "double", "char", "if", "else", "for", "while",
  "return", "struct", "const", "static", "unsigned", "signed", "short",
  "long", "break", "continue", "switch", "case", "default", "sizeof",
  "typedef", "read_adc", "HAL_OK", "NULL"
]);

function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

export interface LogEvent {
  name: string;
  event: "insert" | "lookup" | "promote";
  rep: Representation;
  bytes: number;
}

export interface SimResult {
  budgetSymBytes: number;
  conventionalBytes: number;
  ratio: number;
  promotions: number;
  repCounts: Record<Representation, number>;
  log: LogEvent[];
}

interface SeenEntry {
  rep: Representation;
  bytes: number;
  accessCount: number;
}

export function runPolicySim(code: string, cfg: PolicyConfig = DEFAULT_CONFIG): SimResult {
  const tokens = code.match(/\b[A-Za-z_][A-Za-zA-Z0-9_]*\b/g) ?? [];
  const seen = new Map<string, SeenEntry>();
  const poolInterned = new Set<string>();
  let trackerBytes = 0;
  let conventionalBytes = 0;
  let lastInserted = "";
  let promotions = 0;
  const repCounts: Record<Representation, number> = { INLINE: 0, INTERNED: 0, COMPRESSED: 0 };
  const log: LogEvent[] = [];

  for (const name of tokens) {
    if (KEYWORDS.has(name) || /^\d/.test(name)) continue;

    if (!seen.has(name)) {
      const pressure = trackerBytes / cfg.budgetBytes;
      const longId = name.length >= cfg.compressMinLen;
      const prefixShared = lastInserted ? commonPrefixLen(lastInserted, name) : 0;
      const prefixSimilar = prefixShared >= cfg.prefixMinShared;
      const highPressure = pressure >= cfg.highPressure;
      const lowPressure = pressure < cfg.lowPressure;
      const hot = false;

      let rep: Representation;
      if (highPressure && longId && !hot) rep = "COMPRESSED";
      else if (longId && prefixSimilar && !hot) rep = "COMPRESSED";
      else if (name.length < cfg.inlineMaxLen && lowPressure) rep = "INLINE";
      else rep = "INTERNED";

      let bytes: number;
      if (rep === "INLINE") {
        bytes = name.length + 1 + OVERHEAD.inline;
      } else if (rep === "INTERNED") {
        bytes = OVERHEAD.interned + (poolInterned.has(name) ? 0 : OVERHEAD.poolStructBase + name.length + 1);
        poolInterned.add(name);
      } else {
        const suffixLen = Math.max(0, name.length - prefixShared);
        bytes = 1 + suffixLen + 1 + OVERHEAD.compressedLink;
      }

      trackerBytes += bytes;
      repCounts[rep]++;
      seen.set(name, { rep, bytes, accessCount: 0 });
      lastInserted = name;
      conventionalBytes += name.length + 1 + OVERHEAD.inline;
      log.push({ name, event: "insert", rep, bytes });
    } else {
      const entry = seen.get(name)!;
      entry.accessCount++;
      if (entry.rep === "COMPRESSED" && entry.accessCount >= cfg.hotThreshold) {
        trackerBytes -= entry.bytes;
        repCounts[entry.rep]--;
        const newBytes = OVERHEAD.interned + (poolInterned.has(name) ? 0 : OVERHEAD.poolStructBase + name.length + 1);
        poolInterned.add(name);
        trackerBytes += newBytes;
        repCounts.INTERNED++;
        entry.rep = "INTERNED";
        entry.bytes = newBytes;
        promotions++;
        log.push({ name, event: "promote", rep: "INTERNED", bytes: newBytes });
      } else {
        log.push({ name, event: "lookup", rep: entry.rep, bytes: 0 });
      }
    }
  }

  const ratio = trackerBytes > 0 ? conventionalBytes / trackerBytes : 1;
  return { budgetSymBytes: trackerBytes, conventionalBytes, ratio, promotions, repCounts, log };
}

export const CODE_PRESETS = [
  {
    id: "sensor-poll",
    title: "Sensor Poll Loop (Default)",
    code: `// embedded sensor-poll loop -- typical BUDGET-SYM target
void poll_sensors() {
  int temperatureSensorReading = read_adc(0);
  int temperatureSensorBaseline = read_adc(1);
  int temperatureSensorCalibrated = 0;

  float humiditySensorReading = read_adc(2);
  float pressureSensorReading = read_adc(3);

  int i = 0;
  int count = 0;
  int total = 0;

  for (i = 0; i < 8; i++) {
    total = total + temperatureSensorReading;
    count = count + 1;
    temperatureSensorReading = read_adc(0);
  }

  int average = total / count;
  int temperatureSensorReading2 = average;
}`,
  },
  {
    id: "prefix-heavy",
    title: "HAL Driver (High Prefix Similarity)",
    code: `// Peripheral HAL driver with shared prefix naming convention
void HAL_GPIO_Init_Sequence() {
  int systemControlRegisterBankA = 0x4000;
  int systemControlRegisterBankB = 0x4004;
  int systemControlRegisterBankC = 0x4008;

  int gpioPinConfigurationRegister0 = 0x01;
  int gpioPinConfigurationRegister1 = 0x02;
  int gpioPinConfigurationRegister2 = 0x04;
  int gpioPinConfigurationRegister3 = 0x08;

  int gpioPinInterruptStatusMaster = 0;
  int gpioPinInterruptStatusSlave = 0;

  gpioPinInterruptStatusMaster = systemControlRegisterBankA | gpioPinConfigurationRegister0;
  gpioPinInterruptStatusSlave = systemControlRegisterBankB | gpioPinConfigurationRegister1;
}`,
  },
  {
    id: "hot-promotion",
    title: "Tight Loop (Hot Access Promotion)",
    code: `// Hot-variable access demonstrating dynamic runtime promotion
void process_packet_buffer() {
  int packetHeaderChecksumValue = calculate_crc();
  int packetPayloadLengthBytes = 512;
  int networkInterfaceBufferPointer = 0x8000;

  int idx = 0;
  int checksumAccumulator = 0;

  // Repeated accesses to packetHeaderChecksumValue trigger promotion
  for (idx = 0; idx < 10; idx++) {
    checksumAccumulator += packetHeaderChecksumValue;
    checksumAccumulator += packetHeaderChecksumValue;
    checksumAccumulator += packetHeaderChecksumValue;
    checksumAccumulator += packetHeaderChecksumValue;
  }
}`,
  },
];

export const DEFAULT_CODE = CODE_PRESETS[0].code;
