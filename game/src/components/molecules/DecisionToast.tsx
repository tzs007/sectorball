export type DecisionToastProps = { readonly text: string | null };

export const DecisionToast = ({ text }: DecisionToastProps) =>
  text === null ? null : (
    <div className="decision-toast" role="status">
      {text}
    </div>
  );
