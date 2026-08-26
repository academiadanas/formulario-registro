'use client';

interface WizardHeaderProps {
  title: string;
  currentStep: number;
  totalSteps: number;
}

export function WizardHeader({ title, currentStep, totalSteps }: WizardHeaderProps) {
  return (
    <div className="px-5 pt-5 pb-4 sm:px-8 sm:pt-6 border-b border-border-warm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-serif text-text-primary text-base sm:text-lg font-semibold">
          {title}
        </span>
        <span className="text-text-secondary text-xs sm:text-sm font-medium">
          {currentStep} de {totalSteps}
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              step <= currentStep ? 'bg-primary' : 'bg-border-warm'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
