import { useState } from "react";

import { Dialog } from "@calcom/features/components/controlled-dialog";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import type { AppRouter } from "@calcom/trpc/types/server/routers/_app";
import { Button } from "@calcom/ui/components/button";
import { ConfirmationDialogContent } from "@calcom/ui/components/dialog";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@calcom/ui/components/dropdown";
import { showToast } from "@calcom/ui/components/toast";

import type { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Credentials = RouterOutput["viewer"]["apps"]["appCredentialsByType"]["credentials"];

interface Props {
  credentials: Credentials;
  onSuccess?: () => void;
}

export function MultiDisconnectIntegration({ credentials, onSuccess }: Props) {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const [credentialToDelete, setCredentialToDelete] = useState<{
    id: number;
    teamId: number | null;
    name: string | null;
  } | null>(null);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);

  const mutation = trpc.viewer.deleteCredential.useMutation({
    onSuccess: () => {
      showToast(t("app_removed_successfully"), "success");
      onSuccess && onSuccess();
      setConfirmationDialogOpen(false);
    },
    onError: () => {
      showToast(t("error_removing_app"), "error");
      setConfirmationDialogOpen(false);
    },
    async onSettled() {
      await utils.viewer.connectedCalendars.invalidate();
      await utils.viewer.apps.integrations.invalidate();
    },
  });

  const getUserDisplayName = (user: (typeof credentials)[number]["user"]) => {
    if (!user) return null;
    // Check if 'name' property exists on user
    if ("name" in user) return user.name;
    // Otherwise use email if available
    if ("email" in user) return user.email;
    return null;
  };

  return (
    <>
      <Dropdown>
        <DropdownMenuTrigger asChild>
          <Button color="secondary">{t("disconnect")}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="w-48 text-left text-xs">{t("disconnect_app_from")}</div>
          </DropdownMenuLabel>
          {credentials.map((cred) => (
            <DropdownMenuItem key={cred.id}>
              <DropdownItem
                type="button"
                color="destructive"
                className="hover:bg-subtle hover:text-emphasis w-full border-0"
                StartIcon={cred.teamId ? "users" : "user"}
                onClick={() => {
                  setCredentialToDelete({
                    id: cred.id,
                    teamId: cred.teamId,
                    name: cred.team?.name || getUserDisplayName(cred.user) || null,
                  });
                  setConfirmationDialogOpen(true);
                }}>
                <div className="flex flex-col text-left">
                  <span>{cred.team?.name || getUserDisplayName(cred.user) || t("unnamed")}</span>
                </div>
              </DropdownItem>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </Dropdown>

      <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
        <ConfirmationDialogContent
          variety="danger"
          title={t("remove_app")}
          confirmBtnText={t("yes_remove_app")}
          onConfirm={() => {
            if (credentialToDelete) {
              mutation.mutate({
                id: credentialToDelete.id,
                ...(credentialToDelete.teamId ? { teamId: credentialToDelete.teamId } : {}),
              });
            }
          }}>
          <p className="mt-5">
            {t("are_you_sure_you_want_to_remove_this_app_from")} {credentialToDelete?.name || t("unnamed")}?
          </p>
        </ConfirmationDialogContent>
      </Dialog>
    </>
  );
}
