# Rich Task Management for Projects

Rebuild the Tasks tab on the project page around a world-class "New Task" card with the full field set, and rework the task list to show stages, priorities, vendors and dependencies.

## The Add Task card

A single elegant card, grouped into three quiet sections instead of one long form:

1. **What** — Title (large, borderless input), Task Category (free text with autocomplete from categories already used), Remarks (multiline).
2. **Who** — Project (prefilled with the current project, shown as a dropdown of active projects), Vendor Category (dropdown), Vendors (multi-select chips, limited to vendors assigned to this project in the chosen category), Quote Status (read-only badge shown automatically next to each selected vendor when that vendor has a quote on this project), Assignee (dropdown of staff users).
3. **When** — Priority (P0–P3 segmented selector, colour coded red→grey), Deadline (date picker), Stage (segmented/dropdown: Not Yet Picked Up, In Progress, Pending on Client, Pending on Vendor, Pending on Planner, Held Up, Done), Preceding Task and Succeeding Task (dropdowns of other tasks in the same project).

Behaviour: collapsed to a single "Add task" line by default, expands into the full card; only Title is mandatory; vendor list resets when the vendor category changes; a task cannot depend on itself, and the preceding/succeeding pair is kept consistent (setting one updates the other side).

## The Task list

Replace the flat table with a stage-aware view:

- Default **Board by stage** — one column per stage, cards showing title, priority chip, deadline (red when overdue), assignee initials, vendor chips and a link icon when the task has dependencies. Dragging a card between columns changes its stage.
- **Table view** toggle — Title, Category, Priority, Stage, Deadline, Assignee, Vendors, Depends on. Sortable, filterable by stage / priority / assignee.
- Clicking a task opens the same card in edit mode.
- Done tasks collapse into a "Done" column/section rather than a strikethrough row.
- Group headers show counts; overdue and P0 items get a subtle marker.

The Overview tab's task snippet keeps working, updated to the new priority and stage labels.

## Data changes

New columns on the tasks table: `task_category` (text), `vendor_category` (text), `stage` (enum), `assignee_user_id`, `remarks`, `preceding_task_id`, `succeeding_task_id` (self references). A new join table links a task to multiple vendors. Priority becomes P0–P3, migrating existing rows: high→P1, medium→P2, low→P3; the `done` flag stays in sync with stage = Done.

Tasks remain staff-only (admin + employee) — clients never see them. Row security mirrors the current tasks table; the new vendor-link table gets the same staff-only rules and grants.

## Technical notes

- Migration: add columns + `task_stage` enum + `project_task_vendors` table with grants, RLS and staff-only policies; backfill priority values and stage from `done`.
- `src/lib/project-tasks.functions.ts`: extend list/create/update to handle the new fields and vendor links; add a staff-accessible `listAssignableStaff` server fn (current `listUsers` is admin-only) and reuse the existing project-vendor and quote queries to supply the vendor dropdown and quote-status badges.
- New components under `src/components/admin/project-tabs/tasks/`: `TaskCard` (add/edit form), `TaskBoard`, `TaskTable`, `StagePill`, `PriorityChip`; `ProjectTasksTab.tsx` becomes the shell with the view toggle.
- Date picker uses the shadcn Calendar in a Popover with `pointer-events-auto`; styling follows the existing charcoal-header / cream-row table language.
