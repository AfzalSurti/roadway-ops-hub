import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LetterImportDialog } from "@/components/admin/LetterImportDialog";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { LetterCategory, LetterEntryItem, LetterProjectItem } from "@/lib/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, CheckCircle2, Download, FileUp, Link2, Loader2, Mail, MailWarning, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { downloadLetterImportTemplate } from "@/lib/letter-import";
import { cn } from "@/lib/utils";

type ViewMode = "new" | "list" | "database" | "pending";

const SUBJECT_CATEGORIES = ["Utility", "Tender", "LAQ", "Work Order", "Other"];

function normalizeSerialLabel(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^0*(\d+)([a-z]*)$/i);
  if (!match) return trimmed;
  return `${Number(match[1])}${match[2].toLowerCase()}`;
}

function SuggestField({
  value,
  onChange,
  onBlur,
  placeholder,
  suggestions
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    const starts = suggestions.filter((item) => item.toLowerCase().startsWith(q));
    const contains = suggestions.filter(
      (item) => !item.toLowerCase().startsWith(q) && item.toLowerCase().includes(q)
    );
    return [...starts, ...contains].slice(0, 8);
  }, [suggestions, value]);

  return (
    <div className="relative min-w-[160px]">
      <textarea
        value={value}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
          onBlur?.(value);
        }}
        className="w-full min-h-[2.5rem] resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-xs leading-snug whitespace-pre-wrap break-words outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && filtered.length > 0 ? (
        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto rounded-lg border border-border/50 bg-card shadow-lg">
          {filtered.map((item) => (
            <button
              key={item}
              type="button"
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary/60 whitespace-normal break-words"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(item);
                setOpen(false);
                onBlur?.(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function calendarParts(value?: string | null): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

/** Display letter date as dd/mm/yyyy using the stored calendar day (UTC parts). */
function toDateInput(value?: string | null) {
  const parts = calendarParts(value);
  if (!parts) return "";
  return `${String(parts.d).padStart(2, "0")}/${String(parts.m).padStart(2, "0")}/${parts.y}`;
}

/** Store calendar days at UTC noon so IST/other zones never shift the day. */
function toLetterDateIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function sameCalendarDay(a?: string | null, b?: string | null) {
  const left = calendarParts(a);
  const right = calendarParts(b);
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.y === right.y && left.m === right.m && left.d === right.d;
}

/** Local Date for DayPicker from stored ISO (uses UTC calendar day). */
function pickerDateFromIso(value?: string | null): Date | undefined {
  const parts = calendarParts(value);
  if (!parts) return undefined;
  return new Date(parts.y, parts.m - 1, parts.d);
}

/** Parse dd/mm/yyyy (or dd-mm-yyyy / yyyy-mm-dd) to ISO string, or null if empty/invalid. */
function parseManualDate(value: string): string | null | undefined {
  const text = value.trim();
  if (!text) return null;
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (
      Number.isNaN(probe.getTime()) ||
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      return undefined;
    }
    return toLetterDateIso(year, month, day);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return toLetterDateIso(year, month, day);
  }
  return undefined;
}

function LetterDateField({
  value,
  onChange,
  className,
  placeholder = "dd/mm/yyyy"
}: {
  value?: string | null;
  onChange: (iso: string | null) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => toDateInput(value));
  const selected = pickerDateFromIso(value);

  useEffect(() => {
    setText(toDateInput(value));
  }, [value]);

  const commitText = () => {
    const parsed = parseManualDate(text);
    if (text.trim() && parsed === undefined) {
      toast.error("Use date format dd/mm/yyyy");
      setText(toDateInput(value));
      return;
    }
    const next = parsed ?? null;
    if (sameCalendarDay(value, next)) {
      setText(toDateInput(value));
      return;
    }
    onChange(next);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        type="text"
        inputMode="numeric"
        className="h-8 text-xs"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Pick date"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) {
                onChange(null);
                setText("");
                setOpen(false);
                return;
              }
              const iso = toLetterDateIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
              setText(toDateInput(iso));
              onChange(iso);
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function LetterNumbering() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("list");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("");
  const [filterNumber, setFilterNumber] = useState("");
  const [filterShortName, setFilterShortName] = useState("");
  const [importMainId, setImportMainId] = useState("");
  const [importDetails, setImportDetails] = useState({
    projectNumber: "",
    projectCode: "",
    shortName: "",
    fullName: "",
    projectCoordinator: "",
    projectEngineer: ""
  });
  const [letterImportOpen, setLetterImportOpen] = useState(false);
  const [oldLetterOpen, setOldLetterOpen] = useState(false);
  const [letterFilters, setLetterFilters] = useState({
    serial: "",
    date: "",
    letterNumber: "",
    category: "ALL",
    needsReply: "ALL",
    sentBy: "",
    sentTo: "",
    subject: "",
    ccTo: "",
    subjectCategory: "",
    linked: "ALL",
    replyOfSerial: "",
    remark: ""
  });
  const [oldLetterForm, setOldLetterForm] = useState({
    category: "OUTWARD" as LetterCategory,
    serialLabel: "",
    outwardSequence: "",
    letterNumber: "",
    letterDate: "",
    sentBy: "",
    sentTo: "",
    subject: "",
    ccTo: "",
    subjectCategory: "",
    needsReply: "" as "" | "yes" | "no",
    replyOfSerial: "",
    remark: ""
  });

  const { data: letterProjects = [], isLoading } = useQuery({
    queryKey: ["letter-projects"],
    queryFn: () => api.getLetterProjects()
  });

  const { data: pendingReplies = [], isLoading: loadingPending } = useQuery({
    queryKey: ["letter-pending-replies"],
    queryFn: () => api.getLetterPendingReplies()
  });

  const { data: mainProjects = [], isError: mainProjectsError, isLoading: loadingMainProjects } = useQuery({
    queryKey: ["letter-main-projects"],
    queryFn: async () => {
      try {
        return await api.getLetterMainProjects();
      } catch {
        const projects = await api.getProjects();
        return projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description ?? null,
          projectNumber: project.projectNumber ?? null
        }));
      }
    }
  });

  const { data: selectedProject, isLoading: loadingSelected } = useQuery({
    queryKey: ["letter-project", selectedProjectId],
    queryFn: () => (selectedProjectId ? api.getLetterProject(selectedProjectId) : Promise.resolve(null)),
    enabled: Boolean(selectedProjectId) && view === "database"
  });

  const letters = selectedProject?.letters ?? [];

  const emptyLetterFilters = {
    serial: "",
    date: "",
    letterNumber: "",
    category: "ALL",
    needsReply: "ALL",
    sentBy: "",
    sentTo: "",
    subject: "",
    ccTo: "",
    subjectCategory: "",
    linked: "ALL",
    replyOfSerial: "",
    remark: ""
  };

  const hasLetterFilters = useMemo(
    () =>
      Object.entries(letterFilters).some(([key, value]) => {
        if (key === "category" || key === "needsReply" || key === "linked") {
          return value !== "ALL";
        }
        return Boolean(String(value).trim());
      }),
    [letterFilters]
  );

  const filteredLetters = useMemo(() => {
    const includes = (value: string | null | undefined, query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (value ?? "").toLowerCase().includes(q);
    };

    return letters.filter((letter) => {
      if (!includes(letter.serialLabel, letterFilters.serial)) return false;
      if (letterFilters.date.trim()) {
        const display = toDateInput(letter.letterDate);
        if (!display.toLowerCase().includes(letterFilters.date.trim().toLowerCase())) return false;
      }
      if (!includes(letter.letterNumber, letterFilters.letterNumber)) return false;
      if (letterFilters.category !== "ALL" && letter.category !== letterFilters.category) return false;
      if (letterFilters.needsReply === "yes") {
        if (letter.needsReply !== true) return false;
      } else if (letterFilters.needsReply === "no") {
        if (letter.needsReply !== false) return false;
      } else if (letterFilters.needsReply === "na") {
        if (letter.needsReply !== null && letter.needsReply !== undefined) return false;
      }
      if (!includes(letter.sentBy, letterFilters.sentBy)) return false;
      if (!includes(letter.sentTo, letterFilters.sentTo)) return false;
      if (!includes(letter.subject, letterFilters.subject)) return false;
      if (!includes(letter.ccTo, letterFilters.ccTo)) return false;
      if (!includes(letter.subjectCategory, letterFilters.subjectCategory)) return false;
      if (letterFilters.linked === "yes" && !letter.letterLinkUrl) return false;
      if (letterFilters.linked === "no" && letter.letterLinkUrl) return false;
      if (!includes(letter.replyOfSerial, letterFilters.replyOfSerial)) return false;
      if (!includes(letter.remark, letterFilters.remark)) return false;
      return true;
    });
  }, [letters, letterFilters]);

  const repliedByLinkKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const letter of letters) {
      const serial = (letter.replyOfSerial ?? "").trim();
      if (serial) keys.add(normalizeSerialLabel(serial));
    }
    return keys;
  }, [letters]);

  const isLetterReplyDone = (letter: LetterEntryItem) => {
    if (letter.repliedAt) return true;
    return repliedByLinkKeys.has(normalizeSerialLabel(letter.serialLabel));
  };

  const pendingReplyLetters = useMemo(
    () =>
      letters.filter(
        (letter) =>
          (letter.category === "INWARD" || letter.category === "OTHER") &&
          letter.needsReply === true &&
          !isLetterReplyDone(letter)
      ),
    // isLetterReplyDone depends on repliedByLinkKeys/letters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [letters, repliedByLinkKeys]
  );

  const suggestionQueries = {
    sentBy: useQuery({
      queryKey: ["letter-suggestions", "sentBy", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "sentBy", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    }),
    sentTo: useQuery({
      queryKey: ["letter-suggestions", "sentTo", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "sentTo", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    }),
    subject: useQuery({
      queryKey: ["letter-suggestions", "subject", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "subject", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    }),
    ccTo: useQuery({
      queryKey: ["letter-suggestions", "ccTo", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "ccTo", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    })
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["letter-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["letter-project", selectedProjectId] }),
      queryClient.invalidateQueries({ queryKey: ["letter-main-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["letter-suggestions"] }),
      queryClient.invalidateQueries({ queryKey: ["letter-pending-replies"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    ]);
  };

  const importMutation = useMutation({
    mutationFn: () => {
      if (!importMainId) throw new Error("Select a project from Sankalp Database");
      if (!importDetails.projectNumber.trim()) throw new Error("Enter letter project number (e.g. 376)");
      if (!importDetails.projectCode.trim()) throw new Error("Project code is required");
      return api.importLetterProject({
        mainProjectId: importMainId,
        projectNumber: importDetails.projectNumber.trim(),
        projectCode: importDetails.projectCode.trim().toUpperCase(),
        shortName: importDetails.shortName.trim() || undefined,
        fullName: importDetails.fullName.trim() || undefined,
        projectCoordinator: importDetails.projectCoordinator.trim() || undefined,
        projectEngineer: importDetails.projectEngineer.trim() || undefined
      });
    },
    onSuccess: async () => {
      toast.success("Project added to Letter Data Base");
      setImportMainId("");
      setImportDetails({
        projectNumber: "",
        projectCode: "",
        shortName: "",
        fullName: "",
        projectCoordinator: "",
        projectEngineer: ""
      });
      setView("list");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Import failed")
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.syncLetterProjectToMain(id),
    onSuccess: async () => {
      toast.success("Added to Project section");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sync failed")
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.deleteLetterProject(id),
    onSuccess: async () => {
      toast.success("Letter project deleted");
      if (selectedProjectId) setSelectedProjectId(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed")
  });

  const todayLetterDateIso = () => {
    const now = new Date();
    return toLetterDateIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  };

  const addLetterMutation = useMutation({
    mutationFn: (category: LetterCategory) =>
      api.createLetterEntry(selectedProjectId!, {
        category,
        letterDate: todayLetterDateIso()
      }),
    onSuccess: async () => {
      toast.success("Letter row added");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add letter")
  });

  const addOldLetterMutation = useMutation({
    mutationFn: () => {
      if (!oldLetterForm.serialLabel.trim()) {
        throw new Error("Sr No is required for old letters");
      }
      const parsedDate = parseManualDate(oldLetterForm.letterDate);
      if (oldLetterForm.letterDate.trim() && parsedDate === undefined) {
        throw new Error("Letter Date must be dd/mm/yyyy");
      }
      return api.createLetterEntry(selectedProjectId!, {
        category: oldLetterForm.category,
        serialLabel: oldLetterForm.serialLabel.trim(),
        outwardSequence: oldLetterForm.outwardSequence.trim() || null,
        letterNumber: oldLetterForm.letterNumber.trim() || null,
        letterDate: parsedDate ?? null,
        sentBy: oldLetterForm.sentBy || undefined,
        sentTo: oldLetterForm.sentTo || undefined,
        subject: oldLetterForm.subject || undefined,
        ccTo: oldLetterForm.ccTo || undefined,
        subjectCategory: oldLetterForm.subjectCategory || undefined,
        needsReply:
          oldLetterForm.category === "OUTWARD"
            ? null
            : oldLetterForm.needsReply === "yes"
              ? true
              : oldLetterForm.needsReply === "no"
                ? false
                : null,
        replyOfSerial: oldLetterForm.replyOfSerial.trim() || null,
        remark: oldLetterForm.remark || undefined
      });
    },
    onSuccess: async () => {
      toast.success("Old letter added with existing number");
      setOldLetterOpen(false);
      setOldLetterForm({
        category: "OUTWARD",
        serialLabel: "",
        outwardSequence: "",
        letterNumber: "",
        letterDate: "",
        sentBy: "",
        sentTo: "",
        subject: "",
        ccTo: "",
        subjectCategory: "",
        needsReply: "",
        replyOfSerial: "",
        remark: ""
      });
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add old letter")
  });

  const insertLetterMutation = useMutation({
    mutationFn: (afterLetterId: string) =>
      api.insertLetterEntry(selectedProjectId!, {
        afterLetterId,
        category: "OTHER",
        letterDate: todayLetterDateIso()
      }),
    onSuccess: async () => {
      toast.success("Back-dated row inserted");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Insert failed")
  });

  const updateLetterMutation = useMutation({
    mutationFn: ({
      letterId,
      payload
    }: {
      letterId: string;
      payload: Parameters<typeof api.updateLetterEntry>[1];
    }) => api.updateLetterEntry(letterId, payload),
    onSuccess: async (data, variables) => {
      const extra =
        data && typeof data === "object"
          ? (data as LetterEntryItem & {
              clearedPendingSerial?: string | null;
              reopenedPendingSerial?: string | null;
            })
          : null;
      const cleared = extra?.clearedPendingSerial ?? null;
      const reopened = extra?.reopenedPendingSerial ?? null;

      if (variables.payload.replied === true) toast.success("Marked as replied");
      else if ("replyOfSerial" in variables.payload) {
        if (cleared) {
          toast.success(`Reply linked — #${cleared} marked Reply Done (removed from pending)`);
        } else if (reopened) {
          toast.success(`#${reopened} back to Reply Pending`);
        } else if (variables.payload.replyOfSerial) {
          toast.success("Reply Letter of saved");
        } else {
          toast.success("Reply Letter of cleared");
        }
      } else if (variables.payload.needsReply === true) toast.success("Added to reply list");
      else if (variables.payload.needsReply === false) toast.success("Reply not required");

      // Optimistic cache update for reply-of link / unlink
      if ("replyOfSerial" in variables.payload && selectedProjectId) {
        const nextSerial = (variables.payload.replyOfSerial ?? "").trim();
        const targetKey = nextSerial ? normalizeSerialLabel(nextSerial) : "";
        const reopenKey = reopened ? normalizeSerialLabel(reopened) : "";

        queryClient.setQueryData(
          ["letter-project", selectedProjectId],
          (prev: LetterProjectItem | null | undefined) => {
            if (!prev) return prev;
            return {
              ...prev,
              letters: (prev.letters ?? []).map((item) => {
                if (item.id === variables.letterId) {
                  return { ...item, replyOfSerial: nextSerial || null };
                }
                if (
                  targetKey &&
                  (item.category === "INWARD" || item.category === "OTHER") &&
                  normalizeSerialLabel(item.serialLabel) === targetKey
                ) {
                  return {
                    ...item,
                    needsReply: true,
                    repliedAt: item.repliedAt ?? new Date().toISOString()
                  };
                }
                if (
                  reopenKey &&
                  (item.category === "INWARD" || item.category === "OTHER") &&
                  normalizeSerialLabel(item.serialLabel) === reopenKey
                ) {
                  return { ...item, needsReply: true, repliedAt: null };
                }
                return item;
              })
            };
          }
        );
      }

      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed")
  });

  const deleteLetterMutation = useMutation({
    mutationFn: (letterId: string) => api.deleteLetterEntry(letterId),
    onSuccess: async () => {
      toast.success("Letter deleted");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed")
  });

  const filteredListProjects = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return letterProjects;
    return letterProjects.filter((project) =>
      [project.projectNumber, project.projectCode, project.shortName, project.fullName]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [letterProjects, listFilter]);

  const hasProjectSearch = Boolean(filterNumber.trim() || filterShortName.trim());

  const databaseProjects = useMemo(() => {
    const num = filterNumber.trim().toLowerCase();
    const name = filterShortName.trim().toLowerCase();

    // After selection with empty search: show only the selected project
    if (selectedProjectId && !hasProjectSearch) {
      return letterProjects.filter((project) => project.id === selectedProjectId);
    }

    // No search typed yet → hide full list (like Structure inventory)
    if (!num && !name) return [];

    return letterProjects.filter((project) => {
      const numberOk = !num || project.projectNumber.toLowerCase().startsWith(num);
      const nameOk =
        !name ||
        project.shortName.toLowerCase().startsWith(name) ||
        project.shortName.toLowerCase().includes(name);
      return numberOk && nameOk;
    });
  }, [letterProjects, filterNumber, filterShortName, selectedProjectId, hasProjectSearch]);

  // Do not auto-select first project — user must search & pick
  useEffect(() => {
    if (view !== "database") return;
    if (!selectedProjectId) return;
    // If selected project was deleted, clear selection
    if (!letterProjects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [view, selectedProjectId, letterProjects]);

  const selectLetterProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setLetterFilters(emptyLetterFilters);
    // Clear search so list collapses to only the selected project
    setFilterNumber("");
    setFilterShortName("");
  };

  const changeLetterProject = () => {
    setSelectedProjectId(null);
    setLetterFilters(emptyLetterFilters);
    setFilterNumber("");
    setFilterShortName("");
  };

  const alreadyLinkedMainIds = useMemo(
    () => new Set(letterProjects.map((item) => item.linkedProjectId).filter(Boolean)),
    [letterProjects]
  );

  const importableMainProjects = mainProjects.filter((item) => !alreadyLinkedMainIds.has(item.id));

  const applyMainProjectSelection = (mainId: string) => {
    setImportMainId(mainId);
    const main = mainProjects.find((item) => item.id === mainId);
    if (!main) return;
    setImportDetails((prev) => ({
      ...prev,
      projectCode: (main.projectNumber || prev.projectCode || "").toUpperCase(),
      shortName: main.name || prev.shortName,
      fullName: main.description || prev.fullName
    }));
  };

  const navItems: Array<[ViewMode, string]> = [
    ["new", "New Project Add"],
    ["list", "All Project List"],
    ["database", "Letter Data Base"],
    ["pending", "Reply Pending"]
  ];

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Letter Numbering</h1>
          <p className="page-subtitle">
            DPR Admin letter database — synced with Projects. Geo Designs &amp; Research Pvt. Ltd.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {pendingReplies.length > 0 ? (
            <Badge variant="secondary" className="rounded-full gap-1">
              <MailWarning className="h-3.5 w-3.5" />
              {pendingReplies.length} pending reply
            </Badge>
          ) : null}
          <Badge variant="secondary" className="rounded-full">
            {letterProjects.length} letter project(s)
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-4">
        <div className="glass-panel p-3 space-y-2 h-fit">
          <p className="text-xs font-medium text-muted-foreground px-2 mb-1">Letter Module</p>
          {navItems.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                view === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {label}
                {key === "pending" && pendingReplies.length > 0 ? (
                  <Badge variant="secondary" className="rounded-full h-5 px-1.5 text-[10px]">
                    {pendingReplies.length}
                  </Badge>
                ) : null}
              </span>
            </button>
          ))}
        </div>

        <div className="glass-panel p-5 min-h-[420px]">
          {view === "new" ? (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h2 className="text-lg font-semibold">New Project Add</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Project data already exists in the Sankalp Database. Select a project, fill letter-only
                  details (Letter No., coordinator, engineer), then add it to Letter Data Base.
                </p>
                <p className="text-xs text-muted-foreground mt-2 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
                  To add <strong>many letters at once</strong> (Excel): open <strong>Letter Data Base</strong>,
                  select a project, then use <strong>Sample Excel</strong> / <strong>Import Excel</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Select project from Sankalp Database
                  </label>
                  <Select
                    value={importMainId}
                    onValueChange={applyMainProjectSelection}
                    disabled={loadingMainProjects || importableMainProjects.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingMainProjects
                            ? "Loading projects..."
                            : importableMainProjects.length === 0
                              ? mainProjectsError
                                ? "Could not load projects"
                                : "No projects available to import"
                              : "Select project from Sankalp Database"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {importableMainProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                          {project.projectNumber ? ` (${project.projectNumber})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!loadingMainProjects && importableMainProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {mainProjects.length === 0
                        ? "No projects in Sankalp Project section yet. Create one under Projects first."
                        : "All Sankalp projects are already linked in Letter Numbering."}
                    </p>
                  ) : !loadingMainProjects && importableMainProjects.length > 0 ? (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {importableMainProjects.length} project(s) available to import
                      {mainProjects.length > importableMainProjects.length
                        ? ` (${mainProjects.length - importableMainProjects.length} already linked)`
                        : ""}
                      .
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Letter Project Number *
                    </label>
                    <Input
                      placeholder="e.g. 376"
                      value={importDetails.projectNumber}
                      onChange={(e) =>
                        setImportDetails((prev) => ({ ...prev, projectNumber: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Project Code</label>
                    <Input
                      value={importDetails.projectCode}
                      onChange={(e) =>
                        setImportDetails((prev) => ({
                          ...prev,
                          projectCode: e.target.value.toUpperCase()
                        }))
                      }
                      placeholder="From Sankalp (editable)"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground mb-1.5 block">Project Short Name</label>
                    <Input
                      value={importDetails.shortName}
                      onChange={(e) =>
                        setImportDetails((prev) => ({ ...prev, shortName: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Project Coordinator</label>
                    <Input
                      value={importDetails.projectCoordinator}
                      onChange={(e) =>
                        setImportDetails((prev) => ({ ...prev, projectCoordinator: e.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Project Engineer</label>
                    <Input
                      value={importDetails.projectEngineer}
                      onChange={(e) =>
                        setImportDetails((prev) => ({ ...prev, projectEngineer: e.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground mb-1.5 block">Project Full Name</label>
                    <textarea
                      value={importDetails.fullName}
                      onChange={(e) =>
                        setImportDetails((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm outline-none focus:border-primary/50"
                      placeholder="Fetched from Sankalp — edit if needed"
                    />
                  </div>
                </div>

                <Button
                  className="gap-2"
                  disabled={
                    !importMainId ||
                    !importDetails.projectNumber.trim() ||
                    !importDetails.projectCode.trim() ||
                    importMutation.isPending
                  }
                  onClick={() => importMutation.mutate()}
                >
                  <Plus className="h-4 w-4" />
                  {importMutation.isPending ? "Adding..." : "Add to Letter Data Base"}
                </Button>
              </div>
            </div>
          ) : null}

          {view === "list" ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">All Project List</h2>
                  <p className="text-sm text-muted-foreground mt-1">Letter Data Base projects</p>
                </div>
                <Input
                  className="sm:max-w-xs"
                  placeholder="Filter projects..."
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[960px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="py-3 pr-3 text-left font-medium">Sr.</th>
                      <th className="py-3 px-3 text-left font-medium">Project No.</th>
                      <th className="py-3 px-3 text-left font-medium">Project Code</th>
                      <th className="py-3 px-3 text-left font-medium">Short Name</th>
                      <th className="py-3 px-3 text-left font-medium">Full Name</th>
                      <th className="py-3 px-3 text-left font-medium">Synced</th>
                      <th className="py-3 pl-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                          </span>
                        </td>
                      </tr>
                    ) : null}
                    {!isLoading && filteredListProjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          No letter projects yet. Use New Project Add (from Sankalp Database).
                        </td>
                      </tr>
                    ) : null}
                    {filteredListProjects.map((project: LetterProjectItem, index) => (
                      <tr key={project.id} className="border-b border-border/20 hover:bg-secondary/20">
                        <td className="py-3 pr-3">{index + 1}</td>
                        <td className="py-3 px-3 font-medium">{project.projectNumber}</td>
                        <td className="py-3 px-3">{project.projectCode}</td>
                        <td className="py-3 px-3">{project.shortName}</td>
                        <td className="py-3 px-3 max-w-[280px] whitespace-normal break-words" title={project.fullName}>
                          {project.fullName || "-"}
                        </td>
                        <td className="py-3 px-3">
                          {project.linkedProjectId ? (
                            <Badge variant="secondary">In Projects</Badge>
                          ) : (
                            <Badge variant="outline">Letter only</Badge>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex flex-wrap gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setView("database");
                              }}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Letters
                            </Button>
                            {!project.linkedProjectId ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="gap-1"
                                disabled={syncMutation.isPending}
                                onClick={() => syncMutation.mutate(project.id)}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Add to Projects
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`Delete letter project ${project.shortName}?`)) {
                                  deleteProjectMutation.mutate(project.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {view === "pending" ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold inline-flex items-center gap-2">
                  <MailWarning className="h-5 w-5 text-amber-500" />
                  Reply Pending
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  All Inward / Other letters marked Need reply = Yes across Letter Data Base.
                </p>
              </div>
              {loadingPending ? (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading pending letters...
                </p>
              ) : pendingReplies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No letters pending reply.</p>
              ) : (
                <div className="space-y-2">
                  {pendingReplies.map((letter) => (
                    <div
                      key={letter.id}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {letter.letterProject.projectNumber} · {letter.letterProject.shortName}
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            #{letter.serialLabel} {letter.category}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words">
                          {letter.letterDate ? toDateInput(letter.letterDate) : "No date"}
                          {" · From: "}
                          {letter.sentBy || "-"}
                          {" · "}
                          {letter.subject || "No subject"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            selectLetterProject(letter.letterProject.id);
                            setView("database");
                          }}
                        >
                          Open project
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={updateLetterMutation.isPending}
                          onClick={() =>
                            updateLetterMutation.mutate({
                              letterId: letter.id,
                              payload: { replied: true }
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark replied
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {view === "database" ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Letter Data Base</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Type a project number or short name to search, then select one project (list stays
                  collapsed after selection).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Filter Project Number
                  </label>
                  <Input
                    placeholder="Type e.g. 3 or 376"
                    value={filterNumber}
                    onChange={(e) => {
                      setFilterNumber(e.target.value);
                      // Searching again unlocks the full match list
                      if (selectedProjectId && e.target.value.trim()) {
                        // keep selected until user picks another
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Filter Project Short Name
                  </label>
                  <Input
                    placeholder="Type e.g. Vadodara"
                    value={filterShortName}
                    onChange={(e) => setFilterShortName(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/40 overflow-hidden">
                <div className="bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground grid grid-cols-2 gap-2">
                  <span>Project Number</span>
                  <span>Project Short Name</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/30">
                  {!hasProjectSearch && !selectedProjectId ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      Type in the filters above to find a project. The full list stays hidden until you
                      search.
                    </p>
                  ) : databaseProjects.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No projects match the filters.
                    </p>
                  ) : (
                    databaseProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => selectLetterProject(project.id)}
                        className={`w-full grid grid-cols-2 gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                          selectedProjectId === project.id ? "bg-primary/15" : "hover:bg-secondary/30"
                        }`}
                      >
                        <span className="font-medium">{project.projectNumber}</span>
                        <span className="truncate">{project.shortName}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedProjectId && selectedProject ? (
                <>
                  <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm font-medium flex flex-wrap items-center gap-2">
                    <span>
                      {selectedProject.projectNumber}, {selectedProject.shortName}
                    </span>
                    {!selectedProject.linkedProjectId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={syncMutation.isPending}
                        onClick={() => syncMutation.mutate(selectedProject.id)}
                      >
                        Add to Project section
                      </Button>
                    ) : (
                      <Badge variant="secondary">Synced</Badge>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={changeLetterProject}>
                      Change project
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={addLetterMutation.isPending}
                      onClick={() => addLetterMutation.mutate("OUTWARD")}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Outward
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addLetterMutation.isPending}
                      onClick={() => addLetterMutation.mutate("INWARD")}
                    >
                      Add Inward
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addLetterMutation.isPending}
                      onClick={() => addLetterMutation.mutate("OTHER")}
                    >
                      Add Other
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1"
                      onClick={() => setOldLetterOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Old Letter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => downloadLetterImportTemplate()}
                    >
                      <Download className="h-3.5 w-3.5" /> Sample Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1"
                      onClick={() => setLetterImportOpen(true)}
                    >
                      <FileUp className="h-3.5 w-3.5" /> Import Excel
                    </Button>
                    {pendingReplyLetters.length > 0 ? (
                      <Badge variant="secondary" className="rounded-full self-center gap-1">
                        <MailWarning className="h-3.5 w-3.5" />
                        {pendingReplyLetters.length} to reply
                      </Badge>
                    ) : null}
                    {hasLetterFilters ? (
                      <Badge variant="outline" className="rounded-full self-center text-[11px]">
                        Showing {filteredLetters.length} of {letters.length}
                      </Badge>
                    ) : null}
                  </div>

                  {!loadingSelected && pendingReplyLetters.length > 0 ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-2">
                          <MailWarning className="h-4 w-4" />
                          Letters you should reply to
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Inward / Other letters marked “Need reply = Yes”. Linking Sr. in “Reply Letter of”
                          or Mark replied clears them.
                        </p>
                      </div>
                      <div className="space-y-2">
                        {pendingReplyLetters.map((letter) => (
                          <div
                            key={letter.id}
                            className="rounded-lg border border-border/40 bg-card/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                #{letter.serialLabel} · {letter.letterNumber || letter.category}
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  {letter.category}
                                </Badge>
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words">
                                {letter.letterDate ? toDateInput(letter.letterDate) : "No date"}
                                {" · From: "}
                                {letter.sentBy || "-"}
                                {" · "}
                                {letter.subject || "No subject"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="gap-1 shrink-0"
                              disabled={updateLetterMutation.isPending}
                              onClick={() =>
                                updateLetterMutation.mutate({
                                  letterId: letter.id,
                                  payload: { replied: true }
                                })
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark replied
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {loadingSelected ? (
                    <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading letters...
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/40">
                      <table className="w-full text-xs min-w-[1700px] table-auto">
                        <thead>
                          <tr className="bg-secondary/40 text-muted-foreground">
                            <th className="p-2 text-left font-medium w-14">Sr.</th>
                            <th className="p-2 text-left font-medium w-32">Date</th>
                            <th className="p-2 text-left font-medium w-48">Letter Number</th>
                            <th className="p-2 text-left font-medium w-32">Category</th>
                            <th className="p-2 text-left font-medium w-36">Need reply?</th>
                            <th className="p-2 text-left font-medium min-w-[180px]">Sent By</th>
                            <th className="p-2 text-left font-medium min-w-[180px]">Sent To</th>
                            <th className="p-2 text-left font-medium min-w-[200px]">Subject</th>
                            <th className="p-2 text-left font-medium min-w-[160px]">CC To</th>
                            <th className="p-2 text-left font-medium w-36">Subject Cat.</th>
                            <th className="p-2 text-left font-medium w-28">Linked</th>
                            <th className="p-2 text-left font-medium w-28">Reply Letter of</th>
                            <th className="p-2 text-left font-medium min-w-[160px]">Remark if Any</th>
                            <th className="p-2 text-right font-medium w-24"> </th>
                          </tr>
                          <tr className="bg-secondary/25 border-t border-border/20">
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.serial}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({ ...prev, serial: e.target.value }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="dd/mm/yyyy"
                                value={letterFilters.date}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({ ...prev, date: e.target.value }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.letterNumber}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({
                                    ...prev,
                                    letterNumber: e.target.value
                                  }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Select
                                value={letterFilters.category}
                                onValueChange={(value) =>
                                  setLetterFilters((prev) => ({ ...prev, category: value }))
                                }
                              >
                                <SelectTrigger className="h-7 text-[11px]">
                                  <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ALL">All</SelectItem>
                                  <SelectItem value="INWARD">Inward</SelectItem>
                                  <SelectItem value="OUTWARD">Outward</SelectItem>
                                  <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </th>
                            <th className="p-1.5">
                              <Select
                                value={letterFilters.needsReply}
                                onValueChange={(value) =>
                                  setLetterFilters((prev) => ({ ...prev, needsReply: value }))
                                }
                              >
                                <SelectTrigger className="h-7 text-[11px]">
                                  <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ALL">All</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="na">N/A</SelectItem>
                                </SelectContent>
                              </Select>
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.sentBy}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({ ...prev, sentBy: e.target.value }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.sentTo}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({ ...prev, sentTo: e.target.value }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.subject}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({ ...prev, subject: e.target.value }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.ccTo}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({ ...prev, ccTo: e.target.value }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.subjectCategory}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({
                                    ...prev,
                                    subjectCategory: e.target.value
                                  }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Select
                                value={letterFilters.linked}
                                onValueChange={(value) =>
                                  setLetterFilters((prev) => ({ ...prev, linked: value }))
                                }
                              >
                                <SelectTrigger className="h-7 text-[11px]">
                                  <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ALL">All</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.replyOfSerial}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({
                                    ...prev,
                                    replyOfSerial: e.target.value
                                  }))
                                }
                              />
                            </th>
                            <th className="p-1.5">
                              <Input
                                className="h-7 text-[11px]"
                                placeholder="Filter"
                                value={letterFilters.remark}
                                onChange={(e) =>
                                  setLetterFilters((prev) => ({ ...prev, remark: e.target.value }))
                                }
                              />
                            </th>
                            <th className="p-1.5 text-right">
                              {hasLetterFilters ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => setLetterFilters(emptyLetterFilters)}
                                >
                                  Clear
                                </Button>
                              ) : null}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {letters.length === 0 ? (
                            <tr>
                              <td colSpan={14} className="p-8 text-center text-muted-foreground">
                                No letters yet. Add Inward / Outward / Other, or Add Old Letter / Import Excel for existing numbers.
                              </td>
                            </tr>
                          ) : null}
                          {letters.length > 0 && filteredLetters.length === 0 ? (
                            <tr>
                              <td colSpan={14} className="p-8 text-center text-muted-foreground">
                                No letters match the filters.{" "}
                                <button
                                  type="button"
                                  className="underline underline-offset-2"
                                  onClick={() => setLetterFilters(emptyLetterFilters)}
                                >
                                  Clear filters
                                </button>
                              </td>
                            </tr>
                          ) : null}
                          {filteredLetters.map((letter: LetterEntryItem) => {
                            const isInsert = /[a-z]/i.test(letter.serialLabel);
                            return (
                              <tr
                                key={letter.id}
                                className={`border-t border-border/20 align-top ${isInsert ? "bg-sky-500/5" : ""}`}
                              >
                                <td className="p-2 font-medium">{letter.serialLabel}</td>
                                <td className="p-2">
                                  <LetterDateField
                                    value={letter.letterDate}
                                    onChange={(nextIso) => {
                                      if (sameCalendarDay(letter.letterDate, nextIso)) return;
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: { letterDate: nextIso }
                                      });
                                    }}
                                  />
                                </td>
                                <td className="p-2 font-mono text-[11px] whitespace-normal break-all">
                                  {letter.letterNumber || "-"}
                                </td>
                                <td className="p-2">
                                  <Select
                                    value={letter.category}
                                    onValueChange={(value: LetterCategory) =>
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: { category: value }
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="INWARD">Inward</SelectItem>
                                      <SelectItem value="OUTWARD">Outward</SelectItem>
                                      <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  {letter.category === "OUTWARD" ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <div className="space-y-1">
                                      <Select
                                        value={
                                          letter.needsReply === true
                                            ? "yes"
                                            : letter.needsReply === false
                                              ? "no"
                                              : "__unset__"
                                        }
                                        onValueChange={(value) =>
                                          updateLetterMutation.mutate({
                                            letterId: letter.id,
                                            payload: {
                                              needsReply:
                                                value === "yes" ? true : value === "no" ? false : null,
                                              ...(value !== "yes" ? { replied: false } : {})
                                            }
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__unset__">Select…</SelectItem>
                                          <SelectItem value="yes">Yes — need reply</SelectItem>
                                          <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {letter.needsReply === true && isLetterReplyDone(letter) ? (
                                        <p className="text-[10px] text-emerald-600 font-medium">Reply Done</p>
                                      ) : letter.needsReply === true ? (
                                        <p className="text-[10px] text-amber-600">Pending reply</p>
                                      ) : null}
                                    </div>
                                  )}
                                </td>
                                {(
                                  [
                                    ["sentBy", suggestionQueries.sentBy.data ?? []],
                                    ["sentTo", suggestionQueries.sentTo.data ?? []],
                                    ["subject", suggestionQueries.subject.data ?? []],
                                    ["ccTo", suggestionQueries.ccTo.data ?? []]
                                  ] as const
                                ).map(([field, suggestions]) => (
                                  <td key={field} className="p-2 align-top">
                                    <SuggestField
                                      value={letter[field]}
                                      suggestions={suggestions}
                                      placeholder={field}
                                      onChange={(value) => {
                                        queryClient.setQueryData(
                                          ["letter-project", selectedProjectId],
                                          (prev: LetterProjectItem | null | undefined) => {
                                            if (!prev) return prev;
                                            return {
                                              ...prev,
                                              letters: (prev.letters ?? []).map((item) =>
                                                item.id === letter.id ? { ...item, [field]: value } : item
                                              )
                                            };
                                          }
                                        );
                                      }}
                                      onBlur={(nextValue) =>
                                        updateLetterMutation.mutate({
                                          letterId: letter.id,
                                          payload: { [field]: nextValue }
                                        })
                                      }
                                    />
                                  </td>
                                ))}
                                <td className="p-2">
                                  <Select
                                    value={letter.subjectCategory || "__none__"}
                                    onValueChange={(value) =>
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: { subjectCategory: value === "__none__" ? "" : value }
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">-</SelectItem>
                                      {SUBJECT_CATEGORIES.map((item) => (
                                        <SelectItem key={item} value={item}>
                                          {item}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  {letter.letterLinkUrl ? (
                                    <a
                                      href={letter.letterLinkUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary underline"
                                    >
                                      Preview
                                    </a>
                                  ) : (
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="URL"
                                      defaultValue=""
                                      onBlur={(e) => {
                                        const url = e.target.value.trim();
                                        if (url) {
                                          updateLetterMutation.mutate({
                                            letterId: letter.id,
                                            payload: { letterLinkUrl: url }
                                          });
                                        }
                                      }}
                                    />
                                  )}
                                </td>
                                <td className="p-2">
                                  <Input
                                    className="h-8 text-xs font-medium"
                                    placeholder="e.g. 2a"
                                    defaultValue={letter.replyOfSerial ?? ""}
                                    key={`${letter.id}-replyOf-${letter.replyOfSerial ?? ""}`}
                                    title="Enter Sr. of the letter you are replying to (auto-clears pending)"
                                    onKeyDown={(e) => {
                                      if (e.key !== "Enter") return;
                                      e.currentTarget.blur();
                                    }}
                                    onBlur={(e) => {
                                      const next = e.target.value.trim();
                                      const prev = (letter.replyOfSerial ?? "").trim();
                                      if (next === prev) return;
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: { replyOfSerial: next || null }
                                      });
                                    }}
                                  />
                                </td>
                                <td className="p-2 align-top">
                                  <textarea
                                    rows={2}
                                    placeholder="Optional"
                                    defaultValue={letter.remark ?? ""}
                                    key={`${letter.id}-remark-${letter.updatedAt}`}
                                    onBlur={(e) => {
                                      const next = e.target.value.trim();
                                      if (next === (letter.remark ?? "").trim()) return;
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: { remark: next }
                                      });
                                    }}
                                    className="w-full min-h-[2.5rem] min-w-[140px] resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-xs leading-snug whitespace-pre-wrap break-words outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  />
                                </td>
                                <td className="p-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      title="Insert back-dated row below"
                                      onClick={() => insertLetterMutation.mutate(letter.id)}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        if (window.confirm("Delete this letter row?")) {
                                          deleteLetterMutation.mutate(letter.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Numbering: Inward/Other use Sr. No. Outward uses{" "}
                    <span className="font-mono">
                      {selectedProject.projectNumber}/{selectedProject.projectCode}/Sr/OutwardSeq
                    </span>
                    . Use + on a row to insert a back-dated letter (3a, 5a…). Inserted Outward rows get a
                    position-based sequence (e.g. after 02 → 02a). Enter Sr. in “Reply Letter of” to
                    auto-clear that letter from pending.
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Search and select a project above to manage letters.
                  </p>
                  <p className="text-xs text-muted-foreground rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
                    After you select a project, use <strong>Add Old Letter</strong> for one historical
                    letter with an existing number, or <strong>Sample Excel</strong> /{" "}
                    <strong>Import Excel</strong> for bulk push (include Sr No, Outward Seq, Letter Number;
                    dates as dd/mm/yyyy).
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {selectedProjectId ? (
        <LetterImportDialog
          open={letterImportOpen}
          onOpenChange={setLetterImportOpen}
          letterProjectId={selectedProjectId}
          projectLabel={
            selectedProject
              ? `${selectedProject.projectNumber} · ${selectedProject.shortName}`
              : undefined
          }
        />
      ) : null}

      <Dialog open={oldLetterOpen} onOpenChange={setOldLetterOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Old Letter</DialogTitle>
            <DialogDescription>
              Push a historical letter that already has a number. Enter the existing Sr No (required).
              Letter Number is optional — leave blank to build from project format. Dates use dd/mm/yyyy.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Category</Label>
              <Select
                value={oldLetterForm.category}
                onValueChange={(value) =>
                  setOldLetterForm((prev) => ({
                    ...prev,
                    category: value as LetterCategory,
                    needsReply: value === "OUTWARD" ? "" : prev.needsReply,
                    outwardSequence: value === "OUTWARD" ? prev.outwardSequence : ""
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTWARD">OUTWARD</SelectItem>
                  <SelectItem value="INWARD">INWARD</SelectItem>
                  <SelectItem value="OTHER">OTHER</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sr No *</Label>
              <Input
                placeholder="e.g. 01 or 3a"
                value={oldLetterForm.serialLabel}
                onChange={(e) => setOldLetterForm((prev) => ({ ...prev, serialLabel: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Letter Date</Label>
              <LetterDateField
                value={
                  oldLetterForm.letterDate
                    ? parseManualDate(oldLetterForm.letterDate) ?? null
                    : null
                }
                onChange={(iso) =>
                  setOldLetterForm((prev) => ({
                    ...prev,
                    letterDate: iso ? toDateInput(iso) : ""
                  }))
                }
              />
            </div>

            {oldLetterForm.category === "OUTWARD" ? (
              <div className="space-y-1.5">
                <Label>Outward Seq</Label>
                <Input
                  placeholder="e.g. 01 or 02a"
                  value={oldLetterForm.outwardSequence}
                  onChange={(e) =>
                    setOldLetterForm((prev) => ({ ...prev, outwardSequence: e.target.value }))
                  }
                />
              </div>
            ) : null}

            <div className={`space-y-1.5 ${oldLetterForm.category === "OUTWARD" ? "" : "sm:col-span-2"}`}>
              <Label>Letter Number (optional)</Label>
              <Input
                placeholder="Leave blank to auto-build"
                value={oldLetterForm.letterNumber}
                onChange={(e) => setOldLetterForm((prev) => ({ ...prev, letterNumber: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sent By</Label>
              <Input
                value={oldLetterForm.sentBy}
                onChange={(e) => setOldLetterForm((prev) => ({ ...prev, sentBy: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sent To</Label>
              <Input
                value={oldLetterForm.sentTo}
                onChange={(e) => setOldLetterForm((prev) => ({ ...prev, sentTo: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject</Label>
              <Input
                value={oldLetterForm.subject}
                onChange={(e) => setOldLetterForm((prev) => ({ ...prev, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>CC To</Label>
              <Input
                value={oldLetterForm.ccTo}
                onChange={(e) => setOldLetterForm((prev) => ({ ...prev, ccTo: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Subject Category</Label>
              <Select
                value={oldLetterForm.subjectCategory || "__none__"}
                onValueChange={(value) =>
                  setOldLetterForm((prev) => ({
                    ...prev,
                    subjectCategory: value === "__none__" ? "" : value
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {SUBJECT_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {oldLetterForm.category !== "OUTWARD" ? (
              <div className="space-y-1.5">
                <Label>Needs Reply</Label>
                <Select
                  value={oldLetterForm.needsReply || "__none__"}
                  onValueChange={(value) =>
                    setOldLetterForm((prev) => ({
                      ...prev,
                      needsReply: value === "__none__" ? "" : (value as "yes" | "no")
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Reply Letter of (Sr)</Label>
              <Input
                placeholder="e.g. 5"
                value={oldLetterForm.replyOfSerial}
                onChange={(e) =>
                  setOldLetterForm((prev) => ({ ...prev, replyOfSerial: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Remark</Label>
              <Input
                value={oldLetterForm.remark}
                onChange={(e) => setOldLetterForm((prev) => ({ ...prev, remark: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOldLetterOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={addOldLetterMutation.isPending || !selectedProjectId}
              onClick={() => addOldLetterMutation.mutate()}
            >
              {addOldLetterMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…
                </>
              ) : (
                "Save Old Letter"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
