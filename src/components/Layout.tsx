import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#FAFAFA] text-[#C8C8C8] animate-page-entrance select-none overflow-hidden">
      {/* Top Bar */}
      <header className="h-[48px] min-h-[48px] w-full bg-[#FFFFFF] border-b border-[#F1F1F1] px-4 flex items-center justify-between shrink-0 z-50">
        <span className="text-[11px] font-medium text-[#C8C8C8] tracking-[0.12em] uppercase">
          Novo Projeto
        </span>
        <div />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full bg-[#FAFAFA] relative overflow-hidden">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="h-[40px] min-h-[40px] w-full bg-[#FFFFFF] border-t border-[#F1F1F1] px-4 flex items-center justify-center shrink-0 z-50">
        <span className="text-[11px] font-normal text-[#C8C8C8]">Pronto para expandir ✨</span>
      </footer>
    </div>
  )
}
