import { Button } from '@/components/videoEditor/ui/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/videoEditor/ui/ui/dialog';
import { Input } from '@/components/videoEditor/ui/ui/input';
import { useState } from 'react';
import { Label } from '@/components/videoEditor/ui/ui/label';

export function RenameProjectDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  projectName,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newName: string) => void;
  projectName: string;
}) {
  const [name, setName] = useState(projectName);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setName(projectName);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{'重命名项目'}</DialogTitle>
        </DialogHeader>

        <DialogBody className="gap-3">
          <Label>{'新名称'}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm(name);
              }
            }}
            placeholder={'输入新名称'}
          />
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenChange(false);
            }}
          >
            {'取消'}
          </Button>
          <Button onClick={() => onConfirm(name)}>{'重命名'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
