interface AccountsButtonProps {
  color: string;
  text: string;
  disabled?: boolean;
}

export default function AccountsButton({ color, text, disabled = false }: AccountsButtonProps) {
  return (
    <button
      style={{ backgroundColor: color }}
      className={"text-white text-2xl font-bold p-2 rounded-lg mt-4 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"}
      disabled={disabled}
      type='submit'
    >
      {text}
    </button>
  )
}