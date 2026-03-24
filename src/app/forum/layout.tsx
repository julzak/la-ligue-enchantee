import { Navbar } from "@/components/layout/Navbar";

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        {children}
      </div>
    </>
  );
}
