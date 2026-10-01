import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** After the first change, a dismissed prompt comes back every this many changes. */
const REPROMPT_EVERY = 5;

/**
 * Guest (anonymous Supabase user) support, mounted once in the root layout:
 * a slim "you're a guest" bar, plus a sign-up dialog that opens after the guest
 * saves a change. Signing up converts the guest account in place, so everything
 * they've entered is kept.
 */
export function GuestSignup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<"change" | "manual">("manual");
  const changes = useRef(0);

  const isGuest = !!user?.is_anonymous;
  // Upgrade started but the email isn't confirmed yet — don't keep asking
  const pendingEmail = isGuest ? user?.new_email : undefined;

  // Every successful mutation is a change the guest would lose without an account
  useEffect(() => {
    if (!isGuest || pendingEmail) return;
    return qc.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      changes.current += 1;
      if (changes.current === 1 || changes.current % REPROMPT_EVERY === 0) {
        setTrigger("change");
        setOpen(true);
      }
    });
  }, [qc, isGuest, pendingEmail]);

  if (!isGuest || pathname === "/auth") return null;

  return (
    <>
      <div className="border-b bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" />
            {pendingEmail
              ? `Almost there: confirm the link we sent to ${pendingEmail} to finish signing up.`
              : "You're using a guest account. Sign up to keep your expenses and use them on any device."}
          </span>
          {!pendingEmail && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                setTrigger("manual");
                setOpen(true);
              }}
            >
              Sign up
            </Button>
          )}
        </div>
      </div>
      <GuestSignupDialog open={open} onOpenChange={setOpen} trigger={trigger} />
    </>
  );
}

function GuestSignupDialog({
  open,
  onOpenChange,
  trigger,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trigger: "change" | "manual";
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Linking an email to the anonymous user keeps its id, so all data stays
      const { data, error } = await supabase.auth.updateUser(
        { email, password },
        { emailRedirectTo: window.location.origin },
      );
      if (error) throw error;
      toast.success(
        data.user.is_anonymous
          ? "Check your email to confirm your account. Your data is kept."
          : "Account created. Your data is saved.",
      );
      onOpenChange(false);
    } catch (err) {
      const message = (err as Error).message;
      toast.error(
        message && message !== "{}" ? message : "Something went wrong. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function signInInstead() {
    await supabase.auth.signOut();
    onOpenChange(false);
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {trigger === "change" ? "Save your changes?" : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            You're using a guest account. Sign up to keep everything you've entered and use it on
            any device.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guest-email">Email</Label>
            <Input
              id="guest-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-password">Password</Label>
            <Input
              id="guest-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Please wait..." : "Sign up"}
            </Button>
          </DialogFooter>
          <button
            type="button"
            onClick={signInInstead}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Already have an account? Sign in (guest data won't be moved)
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
