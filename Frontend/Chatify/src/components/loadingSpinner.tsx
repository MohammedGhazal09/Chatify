import type { FC }  from 'react';

const LoadingSpinner: FC = () => {
  return (
    <div className="min-h-screen bg-[#d3e2f1] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        <p className="text-black text-lg font-medium">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
