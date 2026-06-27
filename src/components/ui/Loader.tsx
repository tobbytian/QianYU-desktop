import { CpuArchitecture } from "./CpuArchitecture";
import { FallingPattern } from "./falling-pattern";

interface LoaderProps {
  fadeOut?: boolean;
}

export function Loader({ fadeOut = false }: LoaderProps) {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 transition-opacity duration-500 ease-out"
      style={{ opacity: fadeOut ? 0 : 1 }}
    >
      <FallingPattern
        className="pointer-events-none absolute inset-0 z-0 opacity-100 [mask-image:radial-gradient(ellipse_at_center,black,transparent_95%)]"
        duration={140}
        blurIntensity="0.35em"
        density={0.8}
      />
      <div className="relative z-10 flex w-full flex-col items-center space-y-10">
        <div className="w-[630px] max-w-[120vw]">
          <CpuArchitecture
            text="仟语"
            animateText
            animateLines
            animateMarkers
          />
        </div>
        <p className="text-base text-gray-400 dark:text-gray-500 tracking-[0.35em]">
          加载中...
        </p>
      </div>
    </div>
  );
}
