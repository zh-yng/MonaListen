import { resolvePending, usePending } from '@/lib/nav-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LeaveGuard() {
  const pending = usePending();
  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && resolvePending(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Leave with unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Your latest edits to this artwork have not been saved. Leaving now discards them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-stay">Keep editing</AlertDialogCancel>
          <AlertDialogAction data-testid="button-leave" onClick={() => resolvePending(true)}>Discard and leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
