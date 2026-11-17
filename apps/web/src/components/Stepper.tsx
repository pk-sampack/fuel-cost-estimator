interface StepperProps {
  step: 1 | 2 | 3;
  labels: [string, string, string];
  ariaLabel: string;
}

export function Stepper({ step, labels, ariaLabel }: StepperProps) {
  return (
    <nav className="stepper" aria-label={ariaLabel}>
      <ol>
        {labels.map((label, index) => {
          const state = index + 1 < step ? 'done' : index + 1 === step ? 'current' : 'todo';
          return (
            <li
              key={label}
              className={`stepper-item stepper-${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="stepper-bar" />
              <span className="stepper-label">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
