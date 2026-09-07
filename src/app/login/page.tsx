import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="flex min-h-svh items-center justify-center">
      <LoginForm next={next ?? "/"} />
    </div>
  )
}
