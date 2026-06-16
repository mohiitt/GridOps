"use client";

import React from "react";
import { useScenario } from "../providers/ScenarioProvider";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useScenario();

  if (toasts.length === 0) return null;

  const toastIcons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const toastBg = {
    success: "bg-white border-emerald-100 shadow-[0_4px_12px_rgba(16,185,129,0.08)]",
    warning: "bg-white border-amber-100 shadow-[0_4px_12px_rgba(245,158,11,0.08)]",
    error: "bg-white border-red-100 shadow-[0_4px_12px_rgba(239,68,68,0.08)]",
    info: "bg-white border-blue-100 shadow-[0_4px_12px_rgba(59,130,246,0.08)]"
  };

  return (
    <div 
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-300 animate-slide-in ${toastBg[toast.type]}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {toastIcons[toast.type]}
          </div>
          <div className="flex-grow">
            <p className="text-xs font-semibold text-[#0F172A] leading-normal pr-4">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-[#94A3B8] hover:text-[#64748B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
