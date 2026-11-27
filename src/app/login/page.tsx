import { redirect } from "next/navigation";

// 로그인은 없앴다. 예전 링크로 들어와도 홈으로
export default function LoginPage() {
  redirect("/");
}
