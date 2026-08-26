'use client';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isSubmitting?: boolean;
  nextLabel?: string;
  submitLabel?: string;
}

export function StepNavigation({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  isSubmitting = false,
  nextLabel = 'Continuar',
  submitLabel = 'Enviar registro',
}: StepNavigationProps) {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex justify-between items-center mt-9 pt-6 border-t-2 border-border-warm gap-4">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onPrev}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-3.5 text-text-secondary font-semibold
            hover:text-text-primary transition-colors duration-300 disabled:opacity-50"
        >
          Atrás
        </button>
      ) : null}

      {isLastStep ? (
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex flex-1 items-center justify-center gap-2 px-8 py-4
            bg-primary text-white rounded-xl
            font-semibold shadow-[0_4px_15px_var(--color-primary-35)]
            hover:-translate-y-0.5 hover:shadow-[0_8px_25px_var(--color-primary-45)]
            active:translate-y-0 transition-all duration-300
            disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isSubmitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>{submitLabel}</>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="flex flex-1 items-center justify-center gap-2 px-8 py-4
            bg-primary text-white rounded-xl
            font-semibold shadow-[0_4px_15px_var(--color-primary-35)]
            hover:-translate-y-0.5 hover:shadow-[0_8px_25px_var(--color-primary-45)]
            active:translate-y-0 transition-all duration-300"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
