"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { useAuthStore } from "@/store/auth"
import { Input, Button } from "@/components/ui"
import { QrCode, ShieldCheck, Eye, EyeOff } from "lucide-react"

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { login, loading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password)
      toast.success("Bienvenido a ActiScan")
      router.push("/dashboard")
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast.error(detail ?? "Correo o contraseña incorrectos")
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-brand-700 flex-col items-center justify-center p-12 text-white">
        <div className="w-20 h-20 bg-white/15 rounded-3xl flex items-center justify-center mb-8">
          <QrCode size={40} />
        </div>
        <h1 className="text-4xl font-bold mb-4">ActiScan</h1>
        <p className="text-white/70 text-center text-lg max-w-xs leading-relaxed">
          Gestión y auditoría de activos fijos mediante códigos QR
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-sm">
          {[
            { label: "Activos registrados", value: "128+" },
            { label: "Auditorías realizadas", value: "340+" },
            { label: "Tiempo de respuesta", value: "<200ms" },
            { label: "Disponibilidad", value: "99.9%" },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl p-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-white/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <QrCode size={24} className="text-brand-700" />
            <span className="text-xl font-bold text-brand-700">ActiScan</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Iniciar sesión</h2>
          <p className="text-gray-500 text-sm mb-8">Accede a tu cuenta para continuar</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="usuario@empresa.mx"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Contraseña"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              error={errors.password?.message}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register("password")}
            />
            <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
              Iniciar sesión
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 justify-center">
            <ShieldCheck size={14} />
            Sesión protegida con JWT y SSL
          </div>
        </div>
      </div>
    </div>
  )
}
