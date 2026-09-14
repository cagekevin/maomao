import { Button } from '@videoEditor/ui/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@videoEditor/ui/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@videoEditor/ui/ui/alert';
import { Label } from '@videoEditor/ui/ui/label';
import { Input } from '@videoEditor/ui/ui/input';

export function DeleteProjectDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  projectNames,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  projectNames: string[];
}) {
  const count = projectNames.length;
  const isSingle = count === 1;
  const singleName = isSingle ? projectNames[0] : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {singleName ? `Delete "${singleName}"?` : `Delete ${count} projects?`}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Alert variant="destructive">
            <AlertTitle>{'警告'}</AlertTitle>
            <AlertDescription>
              {singleName
                ? `This will permanently delete "${singleName}" and all associated files.`
                : `This will permanently delete ${count} projects and all associated files.`}
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-3">
            <Label className="text-xs font-semibold text-muted-foreground">
              {'输入 "DELETE" 以确认'}
            </Label>
            <Input type="text" placeholder="DELETE" size="lg" variant="destructive" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {'取消'}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {'删除项目'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
