import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-20">
      <h1 className="text-3xl font-bold">Страница не найдена</h1>
      <p className="mt-4 text-lg text-muted">
        Возможно, ссылка неполная или класс был удалён. Проверьте адрес — секретная ссылка учителя должна быть скопирована
        целиком.
      </p>
      <Link href="/" className="mt-6 inline-block font-semibold text-accent underline">
        На главную
      </Link>
    </main>
  );
}
