import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buildCron,
  localToUTC,
  humanizeCron,
  humanizeWindow,
  getDefaultTimezone,
  getTimezoneList,
} from "@/lib/cronUtils";
import { Pencil, Trash2 } from "lucide-react";

export interface DisruptionWindowItem {
  startCron: string;
  endCron: string;
}

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const HOURS_12 = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`,
}));
const MINUTES = ["00", "15", "30", "45"];

interface DisruptionWindowEditorProps {
  windows: DisruptionWindowItem[];
  onChange: (windows: DisruptionWindowItem[]) => void;
  disabled?: boolean;
  /** When false, Add Window button is hidden (e.g. when workload does not block consolidation). */
  allowAdd?: boolean;
}

export function DisruptionWindowEditor({
  windows,
  onChange,
  disabled,
  allowAdd = true,
}: DisruptionWindowEditorProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [timezone, setTimezone] = useState(getDefaultTimezone);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"visual" | "raw">("visual");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(21);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(9);
  const [endMinute, setEndMinute] = useState(0);
  const [rawStartCron, setRawStartCron] = useState("0 21 * * 1,2,3,4,5");
  const [rawEndCron, setRawEndCron] = useState("0 9 * * 1,2,3,4,5");

  const timezoneList = useMemo(() => getTimezoneList(), []);
  const editing = editIndex !== null;
  const isOpen = addOpen || editing;

  const startUTC = useMemo(
    () => localToUTC(startHour, startMinute, timezone),
    [startHour, startMinute, timezone]
  );
  const endUTC = useMemo(
    () => localToUTC(endHour, endMinute, timezone),
    [endHour, endMinute, timezone]
  );
  const visualStartCronLocal = useMemo(
    () => buildCron(startMinute, startHour, selectedDays),
    [startMinute, startHour, selectedDays]
  );
  const visualEndCronLocal = useMemo(
    () => buildCron(endMinute, endHour, selectedDays),
    [endMinute, endHour, selectedDays]
  );
  const visualStartCronUTC = useMemo(
    () => buildCron(startUTC.minute, startUTC.hour, selectedDays),
    [startUTC, selectedDays]
  );
  const visualEndCronUTC = useMemo(
    () => buildCron(endUTC.minute, endUTC.hour, selectedDays),
    [endUTC, selectedDays]
  );

  const openAdd = () => {
    setEditIndex(null);
    setAddOpen(true);
    setInputMode("visual");
    setTimezone(getDefaultTimezone());
    setSelectedDays([1, 2, 3, 4, 5]);
    setStartHour(21);
    setStartMinute(0);
    setEndHour(9);
    setEndMinute(0);
    setRawStartCron("0 21 * * 1,2,3,4,5");
    setRawEndCron("0 9 * * 1,2,3,4,5");
  };

  const openEdit = (index: number) => {
    const w = windows[index];
    setEditIndex(index);
    setRawStartCron(w.startCron);
    setRawEndCron(w.endCron);
    setInputMode("raw");
    setAddOpen(true);
  };

  const closeDialog = () => {
    setAddOpen(false);
    setEditIndex(null);
    setTimezoneOpen(false);
  };

  const toggleDay = (d: number) => {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const submitWindow = () => {
    if (inputMode === "raw") {
      const start = rawStartCron.trim();
      const end = rawEndCron.trim();
      if (!start || !end) return;
      const item: DisruptionWindowItem = { startCron: start, endCron: end };
      if (editing && editIndex !== null) {
        const next = [...windows];
        next[editIndex] = item;
        onChange(next);
      } else {
        onChange([...windows, item]);
      }
    } else {
      const item: DisruptionWindowItem = {
        startCron: visualStartCronUTC,
        endCron: visualEndCronUTC,
      };
      if (editing && editIndex !== null) {
        const next = [...windows];
        next[editIndex] = item;
        onChange(next);
      } else {
        onChange([...windows, item]);
      }
    }
    closeDialog();
  };

  const removeWindow = (index: number) => {
    onChange(windows.filter((_, i) => i !== index));
  };

  const humanize = (start: string, end: string, tz?: string) =>
    humanizeWindow(start, end, { timezone: tz });

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Disruption Windows</Label>
          <p className="text-xs text-muted-foreground">
            {windows.length} window{windows.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        {allowAdd && (
          <Button type="button" variant="outline" size="sm" onClick={openAdd} disabled={disabled}>
            Add Window
          </Button>
        )}
      </div>
      {windows.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          {windows.map((w, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-background p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {humanize(w.startCron, w.endCron)}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                  <span title="Start (UTC)">Start</span> <code className="rounded bg-muted/80 px-1">{w.startCron}</code>
                  <span className="mx-1 text-muted-foreground/60">→</span>
                  <span title="End (UTC)">End</span> <code className="rounded bg-muted/80 px-1">{w.endCron}</code>
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(i)}
                  disabled={disabled}
                  aria-label="Edit window"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeWindow(i)}
                  disabled={disabled}
                  aria-label="Delete window"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Disruption Window" : "Add Disruption Window"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Times you set will be converted to UTC for the final cron expressions.
          </p>
          <div className="grid gap-2">
            <Label className="text-sm">Timezone</Label>
            <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={timezoneOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">{timezone || "Select timezone..."}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search timezone..." />
                  <CommandList className="max-h-[min(70vh,20rem)]">
                    <CommandEmpty>No timezone found.</CommandEmpty>
                    <CommandGroup>
                      {timezoneList.map((t) => (
                        <CommandItem
                          key={t}
                          value={t}
                          onSelect={() => {
                            setTimezone(t);
                            setTimezoneOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", timezone === t ? "opacity-100" : "opacity-0")} />
                          {t}
                        </CommandItem>
                      ))}
                      {timezone && !timezoneList.includes(timezone) && (
                        <CommandItem
                          value={timezone}
                          onSelect={() => {
                            setTimezone(timezone);
                            setTimezoneOpen(false);
                          }}
                        >
                          <Check className="mr-2 h-4 w-4 opacity-100" />
                          {timezone}
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "visual" | "raw")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="visual">Visual Builder</TabsTrigger>
              <TabsTrigger value="raw">Raw Cron (UTC)</TabsTrigger>
            </TabsList>
            <TabsContent value="visual" className="space-y-4 pt-2">
              <div>
                <Label className="text-sm">Days of the week</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {DAYS.map((d) => (
                    <Button
                      key={d.value}
                      type="button"
                      variant={selectedDays.includes(d.value) ? "default" : "outline"}
                      size="sm"
                      className="min-w-[2.5rem]"
                      onClick={() => toggleDay(d.value)}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Start time</Label>
                  <div className="mt-1 flex gap-1">
                    <Select
                      value={String(startHour)}
                      onValueChange={(v) => setStartHour(parseInt(v, 10))}
                    >
                      <SelectTrigger className="w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS_12.map((h) => (
                          <SelectItem key={h.value} value={String(h.value)}>
                            {h.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(startMinute).padStart(2, "0")}
                      onValueChange={(v) => setStartMinute(parseInt(v, 10))}
                    >
                      <SelectTrigger className="w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MINUTES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {startHour === 0 && startMinute === 0
                      ? "12:00 AM"
                      : `${startHour > 12 ? startHour - 12 : startHour === 0 ? 12 : startHour}:${String(startMinute).padStart(2, "0")} ${startHour < 12 ? "AM" : "PM"}`}
                  </p>
                </div>
                <div>
                  <Label className="text-sm">End time</Label>
                  <div className="mt-1 flex gap-1">
                    <Select value={String(endHour)} onValueChange={(v) => setEndHour(parseInt(v, 10))}>
                      <SelectTrigger className="w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS_12.map((h) => (
                          <SelectItem key={h.value} value={String(h.value)}>
                            {h.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(endMinute).padStart(2, "0")}
                      onValueChange={(v) => setEndMinute(parseInt(v, 10))}
                    >
                      <SelectTrigger className="w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MINUTES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {endHour === 0 && endMinute === 0
                      ? "12:00 AM"
                      : `${endHour > 12 ? endHour - 12 : endHour === 0 ? 12 : endHour}:${String(endMinute).padStart(2, "0")} ${endHour < 12 ? "AM" : "PM"}`}
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-2 text-xs">
                <p className="font-medium text-muted-foreground">Local time ({timezone})</p>
                <p className="font-mono">Start: {visualStartCronLocal} · End: {visualEndCronLocal}</p>
                <p className="mt-1 font-medium text-muted-foreground">UTC (final output)</p>
                <p className="font-mono">Start: {visualStartCronUTC} · End: {visualEndCronUTC}</p>
              </div>
            </TabsContent>
            <TabsContent value="raw" className="space-y-2 pt-2">
              <div>
                <Label className="text-sm">Start cron (UTC)</Label>
                <Input
                  value={rawStartCron}
                  onChange={(e) => setRawStartCron(e.target.value)}
                  placeholder="0 21 * * 1,2,3,4,5"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-sm">End cron (UTC)</Label>
                <Input
                  value={rawEndCron}
                  onChange={(e) => setRawEndCron(e.target.value)}
                  placeholder="0 9 * * 1,2,3,4,5"
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={submitWindow}>
              {editing ? "Save Window" : "Add Window"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
