import { TelemetryStrip } from './TelemetryStrip';

interface KpiRowProps {
  totalMentions: number;
  changePercent: number;
  negativeSharePercent: number;
  risingTopicsCount: number;
}

export function KpiRow(props: KpiRowProps) {
  return <TelemetryStrip {...props} />;
}
