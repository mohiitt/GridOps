import { Severity } from "../types";
import { OctagonAlert, AlertTriangle, AlertCircle, CheckCircle2, Info, LucideIcon } from "lucide-react";

export interface SeverityStyle {
  textClass: string;
  bgClass: string;
  borderClass: string;
  accentClass: string;
  icon: LucideIcon;
  label: string;
}

export const severityStyles: Record<Severity, SeverityStyle> = {
  critical: {
    textClass: "text-[#B91C1C]",
    bgClass: "bg-[#FEF2F2]",
    borderClass: "border-[#FECACA]",
    accentClass: "bg-[#EF4444]",
    icon: OctagonAlert,
    label: "Critical",
  },
  high: {
    textClass: "text-[#C2410C]",
    bgClass: "bg-[#FFF7ED]",
    borderClass: "border-[#FED7AA]",
    accentClass: "bg-[#F97316]",
    icon: AlertTriangle,
    label: "High",
  },
  medium: {
    textClass: "text-[#B45309]",
    bgClass: "bg-[#FFFBEB]",
    borderClass: "border-[#FDE68A]",
    accentClass: "bg-[#F59E0B]",
    icon: AlertCircle,
    label: "Medium",
  },
  low: {
    textClass: "text-[#15803D]",
    bgClass: "bg-[#F0FDF4]",
    borderClass: "border-[#BBF7D0]",
    accentClass: "bg-[#22C55E]",
    icon: CheckCircle2,
    label: "Low",
  },
  info: {
    textClass: "text-[#1D4ED8]",
    bgClass: "bg-[#EFF6FF]",
    borderClass: "border-[#BFDBFE]",
    accentClass: "bg-[#3B82F6]",
    icon: Info,
    label: "Info",
  },
};
