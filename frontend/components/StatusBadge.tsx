"use client";

import React from "react";
import { Severity } from "../types";
import { severityStyles } from "../lib/severity";

type StatusBadgeProps = {
  severity: Severity;
  label?: string;
  className?: string;
};

export default function StatusBadge({ severity, label, className = "" }: StatusBadgeProps) {
  const style = severityStyles[severity] || severityStyles.info;
  const Icon = style.icon;
  const displayLabel = label || style.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bgClass} ${style.textClass} ${style.borderClass} ${className}`}
      aria-label={`Severity: ${severity}`}
    >
      <Icon className="w-3.5 h-3.5 stroke-[2]" />
      <span>{displayLabel}</span>
    </span>
  );
}
