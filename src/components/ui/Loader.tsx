import { CpuArchitecture } from "./CpuArchitecture";

interface LoaderProps {
  fadeOut?: boolean;
}

export function Loader({ fadeOut = false }: LoaderProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center transition-opacity duration-500 ease-out"
      style={{ opacity: fadeOut ? 0 : 1 }}
    >
      <div className="flex flex-col items-center space-y-8">
        <div className="w-[420px] max-w-[80vw]">
          <CpuArchitecture
            text="仟语"
            animateText
            animateLines
            animateMarkers
          />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 tracking-wider">
          加载中...
        </p>
      </div>
    </div>
  );
}
