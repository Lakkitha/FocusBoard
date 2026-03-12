import { Sparkles, Lock } from 'lucide-react'

export default function AIChat() {
  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center h-full">
      <div className="card w-full text-center py-16 space-y-5">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-brand-amber/10 border border-brand-amber/20 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-brand-amber" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-surface-50">AI Assistant</h2>
          <p className="text-surface-400 text-sm max-w-sm mx-auto">
            Get personalized study tips, completion feedback, and smart insights
            for each of your courses and projects — powered by Claude.
          </p>
        </div>

        {/* Coming soon features */}
        <div className="flex flex-col gap-2 max-w-xs mx-auto text-left">
          {[
            'Ask Claude about any course topic',
            '"You\'re 60% done with AWS — here\'s what to focus on"',
            'Get a weekly study plan tailored to your goals',
            'Project ideas and monetization strategies',
          ].map((feature, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs text-surface-300">
              <Lock className="w-3.5 h-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
              {feature}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3 pt-2">
          <span className="badge bg-brand-amber/10 text-brand-amber text-xs px-3 py-1">
            Coming Soon
          </span>
          <p className="text-[11px] text-surface-500">
            Add your Anthropic API key in settings to enable AI features.
          </p>
        </div>
      </div>
    </div>
  )
}
