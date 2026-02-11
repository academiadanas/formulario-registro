'use client';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex justify-center items-center gap-1.5">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-1.5">
          <span
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-[0.95rem]
              transition-all duration-300 border-2
              ${
                step === currentStep
                  ? 'bg-white text-primary scale-115 shadow-lg border-transparent'
                  : step < currentStep
                    ? 'bg-green-500 text-white border-white/30'
                    : 'bg-white/25 text-white/70 border-transparent'
              }`}
          >
            {step < currentStep ? '✓' : step}
          </span>
          {step < totalSteps && (
            <span
              className={`w-6 h-0.5 rounded transition-all duration-300
                ${step < currentStep ? 'bg-green-400' : 'bg-white/30'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
