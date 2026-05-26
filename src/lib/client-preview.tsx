import { createContext, useContext, type ReactNode } from "react";

interface ClientPreviewContextValue {
  /** When true, the current subtree is rendering the client portal in admin preview mode. */
  isPreview: boolean;
  /** Display name of the client being previewed as. */
  clientLabel?: string;
  /** Project id being previewed (so child components don't need the my-project cache). */
  projectId?: string;
}

const ClientPreviewContext = createContext<ClientPreviewContextValue>({ isPreview: false });

export function ClientPreviewProvider({
  children,
  clientLabel,
  projectId,
}: {
  children: ReactNode;
  clientLabel?: string;
  projectId?: string;
}) {
  return (
    <ClientPreviewContext.Provider value={{ isPreview: true, clientLabel, projectId }}>
      {children}
    </ClientPreviewContext.Provider>
  );
}

export function useClientPreview() {
  return useContext(ClientPreviewContext);
}
