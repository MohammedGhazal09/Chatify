interface AccountsButtonProps {
  color: string;
  text: string;
}

export default function AccountsButton({ color, text }: AccountsButtonProps) {
  return (
    <button className={`bg-[${color}] text-white text-2xl font-bold p-2 rounded-lg mt-4 cursor-nesw-resize`} type='submit'>{text}</button>
  )
}