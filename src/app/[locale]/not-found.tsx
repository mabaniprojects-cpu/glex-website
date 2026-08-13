import { Home, Search } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

export default async function LocaleNotFound() {
  const t = await getTranslations('errors')
  const nav = await getTranslations('nav')

  return (
    <div className="container-glex flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-7xl font-bold text-glex-green-200" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{t('notFoundTitle')}</h1>
      <p className="mt-4 max-w-lg text-lg text-glex-green-800/75">{t('notFoundBody')}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="primary" size="lg">
          <Link href="/">
            <Home className="size-4" aria-hidden="true" />
            {t('notFoundAction')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/marketplace">
            <Search className="size-4" aria-hidden="true" />
            {nav('marketplace')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
