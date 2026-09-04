import { DealStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  DealStatus,
  { label: string; className: string }
> = {
  APPLIED: { label: "Applied", className: "badge badge-applied" },
  ALLOTTED: { label: "Allotted", className: "badge badge-allotted" },
  NOT_ALLOTTED: { label: "Not Allotted", className: "badge badge-not-allotted" },
  SOLD: { label: "Sold", className: "badge badge-sold" },
  SETTLED: { label: "Settled", className: "badge badge-settled" },
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const config = STATUS_CONFIG[status];
  return <span className={config.className}>{config.label}</span>;
}
