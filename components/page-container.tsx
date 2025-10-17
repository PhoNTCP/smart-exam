// Shared wrapper for page content
export const PageContainer = ({ children }: { children: React.ReactNode }) => {
  return <section className="flex flex-1 flex-col gap-6 p-6">{children}</section>;
};
