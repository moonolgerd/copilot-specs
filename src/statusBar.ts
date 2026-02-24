import * as vscode from 'vscode';

export class SpecStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'copilot-specs.openSpecPanel';
    this.item.tooltip = 'Open Copilot Spec Panel';
  }

  update(specName: string | undefined, completed: number, total: number): void {
    if (!specName) {
      this.item.hide();
      return;
    }
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.item.text = `$(tasklist) ${specName}: ${completed}/${total} tasks`;
    this.item.tooltip = `Copilot Specs — ${specName}\n${completed} of ${total} tasks complete (${pct}%)`;
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.item.dispose();
  }
}
