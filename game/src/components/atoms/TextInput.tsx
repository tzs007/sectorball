export type TextInputProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly maxLength?: number;
};

export const TextInput = ({ label, value, onChange, maxLength }: TextInputProps) => (
  <label className="text-input">
    <span className="text-input__label">{label}</span>
    <input
      className="text-input__field"
      type="text"
      value={value}
      maxLength={maxLength}
      onChange={(event) => { onChange(event.target.value); }}
    />
  </label>
);
