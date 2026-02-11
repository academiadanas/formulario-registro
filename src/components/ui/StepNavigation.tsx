'use client';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isSubmitting?: boolean;
}

export function StepNavigation({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  isSubmitting = false,
}: StepNavigationProps) {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex justify-between items-center mt-9 pt-6 border-t-2 border-gray-100 gap-4">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onPrev}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-4 bg-gray-100 text-gray-600 rounded-xl
            font-semibold border-2 border-gray-200 hover:bg-gray-200 hover:text-gray-700
            transition-all duration-300 disabled:opacity-50"
        >
          ← Anterior
        </button>
      ) : (
        <div />
      )}

      {isLastStep ? (
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 min-w-[200px] px-8 py-4
            bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl
            font-semibold shadow-[0_4px_15px_rgba(231,74,130,0.35)]
            hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(231,74,130,0.45)]
            active:translate-y-0 transition-all duration-300
            disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isSubmitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>📤 Enviar Registro</>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 px-8 py-4
            bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl
            font-semibold shadow-[0_4px_15px_rgba(231,74,130,0.35)]
            hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(231,74,130,0.45)]
            active:translate-y-0 transition-all duration-300"
        >
          Siguiente →
        </button>
      )}
    </div>
  );
}
