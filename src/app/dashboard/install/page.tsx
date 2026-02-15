// src/app/install/page.tsx

import { Zap, ArrowRight, Shield, Bot, BarChart3 } from 'lucide-react';

export default function InstallPage() {
  const shopifyAuthUrl = `/api/auth?shop=`;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-6">
            <Zap className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-50">Axiome</h1>
          <p className="text-zinc-400 mt-2">
            L'Agent OS qui transforme votre store Shopify en machine IA.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <Feature
            icon={Bot}
            title="Agents autonomes"
            description="Conversion, rétention, support — vos agents travaillent 24/7."
          />
          <Feature
            icon={BarChart3}
            title="Décisions intelligentes"
            description="Chaque action est mesurée, tracée, optimisée."
          />
          <Feature
            icon={Shield}
            title="Contrôle total"
            description="Budgets, garde-fous, kill switch. Vous gardez le contrôle."
          />
        </div>

        {/* Install form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <form
            action="/api/auth"
            method="GET"
            className="space-y-4"
          >
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">
                Your Shopify Store
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  name="shop"
                  placeholder="your-store"
                  required
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition-colors"
                />
                <span className="text-sm text-zinc-500">.myshopify.com</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg px-4 py-3 text-sm font-bold transition-colors"
            >
              Install Axiome
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="text-[10px] text-zinc-600 text-center mt-3">
            En installant, vous acceptez nos conditions d'utilisation.
            Nous accédons uniquement aux données nécessaires.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-zinc-900/50 rounded-lg p-4">
      <Icon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
            }
