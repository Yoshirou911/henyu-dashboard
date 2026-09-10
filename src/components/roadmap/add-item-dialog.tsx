"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder: string;
  /** existing value → rename / confirm mode */
  initialValue?: string;
  onSubmit: (value: string) => void | Promise<void>;
}

export function AddItemDialog(props: AddItemDialogProps) {
  const { open, onOpenChange, title, description } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {/* Body mounts only while open, so the field resets on every open. */}
        <AddItemForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function AddItemForm({
  onOpenChange,
  placeholder,
  initialValue = "",
  onSubmit,
}: AddItemDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="add-item-input">名前</Label>
        <Input
          id="add-item-input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          キャンセル
        </Button>
        <Button type="submit" disabled={busy || !value.trim()}>
          保存
        </Button>
      </div>
    </form>
  );
}
