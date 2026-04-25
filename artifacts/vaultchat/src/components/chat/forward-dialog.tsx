import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Hash, MessageSquare } from "lucide-react";
import { useRooms } from "@/hooks/use-rooms";
import { useDms } from "@/hooks/use-dms";
import { useForwardMessage, type ForwardTarget } from "@/hooks/use-messages";
import { useToast } from "@/hooks/use-toast";

interface ForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: { type: "room" | "dm"; messageId: number } | null;
}

export function ForwardDialog({ open, onOpenChange, source }: ForwardDialogProps) {
  const { data: rooms } = useRooms();
  const { data: dms } = useDms();
  const forward = useForwardMessage();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ForwardTarget[]>([]);

  const allTargets = useMemo(() => {
    const items: Array<{ key: string; label: string; sub: string; target: ForwardTarget; kind: "room" | "dm" }> = [];
    rooms?.forEach((r) => items.push({
      key: `room-${r.id}`,
      label: r.name,
      sub: "Room",
      target: { type: "room", id: r.id },
      kind: "room",
    }));
    dms?.forEach((d) => items.push({
      key: `dm-${d.userId}`,
      label: d.username,
      sub: "Direct message",
      target: { type: "dm", id: d.userId },
      kind: "dm",
    }));
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [rooms, dms, search]);

  const isSelected = (t: ForwardTarget) =>
    selected.some((s) => s.type === t.type && s.id === t.id);

  const toggle = (t: ForwardTarget) => {
    setSelected((prev) =>
      isSelected(t)
        ? prev.filter((s) => !(s.type === t.type && s.id === t.id))
        : [...prev, t],
    );
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setSelected([]);
      setSearch("");
    }
    onOpenChange(next);
  };

  const handleForward = () => {
    if (!source || selected.length === 0) return;
    forward.mutate(
      { source, targets: selected },
      {
        onSuccess: (data) => {
          const failed = data.delivered.filter((d) => !d.ok);
          if (failed.length === 0) {
            toast({
              title: "Forwarded",
              description: `Sent to ${selected.length} ${selected.length === 1 ? "chat" : "chats"}.`,
            });
            handleClose(false);
          } else {
            toast({
              title: "Forwarded with errors",
              description: `${data.delivered.length - failed.length} succeeded, ${failed.length} failed.`,
              variant: "destructive",
            });
          }
        },
        onError: (err: Error) => {
          toast({
            title: "Forward failed",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>Pick one or more chats to send a copy to.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms and people..."
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border/50 divide-y divide-border/50">
          {allTargets.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No chats found.
            </div>
          ) : (
            allTargets.map((item) => {
              const checked = isSelected(item.target);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggle(item.target)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(item.target)} />
                  <div className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-medium shrink-0">
                    {item.kind === "room" ? (
                      <Hash className="h-4 w-4" />
                    ) : (
                      item.label.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {item.kind === "dm" && <MessageSquare className="h-3 w-3" />}
                      {item.sub}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleForward}
            disabled={selected.length === 0 || forward.isPending || !source}
          >
            {forward.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Forward{selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
