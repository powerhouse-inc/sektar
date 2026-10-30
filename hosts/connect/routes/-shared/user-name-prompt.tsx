import {
  useConnectionStates,
  useDrives,
  useRenownAuthAsync,
  useSelectedDriveId,
  useSync,
} from "@powerhousedao/reactor-browser";
import { UserNameDialog } from "../../../../editors/sektar/kit/user-name-dialog.js";
import {
  setUserName,
  useUserName,
} from "../../../../editors/sektar/kit/user-name.js";

/**
 * Whether the open drive's remote refused the user, which puts Connect's
 * sign-in gate on the page (useDriveAuthGate decides it the same way). When
 * the whole backend refuses, Connect's root gate replaces the shell instead,
 * and this prompt with it.
 */
function useDriveRefused(): boolean {
  const states = useConnectionStates();
  const sync = useSync();
  const selected = useSelectedDriveId();
  if (!selected) return false;
  return (sync?.list() ?? []).some((remote) => {
    if (remote.meta.collectionId.driveId !== selected) return false;
    const state = states.get(remote.meta.name);
    return state?.state === "error" && state.requiresAuth;
  });
}

/**
 * Asks anyone without a name for one, on any screen, once the app has loaded:
 * the drives are known and so is who is signed in, so a redirect back from
 * Renown does not flash it, and it never covers a sign-in gate.
 */
export function UserNamePrompt() {
  const name = useUserName();
  const drives = useDrives();
  const { isResolving } = useRenownAuthAsync();
  const refused = useDriveRefused();
  if (name || drives === undefined || isResolving || refused) return null;
  return <UserNameDialog onSave={setUserName} />;
}
