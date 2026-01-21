export const metadata = {
    title: "ChronosOps MVP",
    description: "Latency spike after deployment demo",
  };
  
  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
          {children}
        </body>
      </html>
    );
  }
  