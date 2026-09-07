"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { login, type LoginState } from "./actions"

const initialState: LoginState = {}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(login, initialState)

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>비밀번호를 입력해주세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <Input
            type="password"
            name="password"
            placeholder="비밀번호"
            autoFocus
            required
            aria-invalid={!!state.error}
          />
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" disabled={isPending} className="justify-center">
            {isPending ? "확인 중..." : "로그인"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
