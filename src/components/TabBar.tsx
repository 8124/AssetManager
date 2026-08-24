import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package } from 'lucide-react';

const TABS = [
  { path: '/', label: '首页', icon: LayoutDashboard, end: true },
  { path: '/physical', label: '实物', icon: Package, end: false },
];

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-white/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 flex-1 max-w-[120px] h-full transition-colors ${
                    isActive
                      ? 'text-[#007AFF]'
                      : 'text-[#8E8E93] hover:text-foreground/70'
                  }`
                }
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
