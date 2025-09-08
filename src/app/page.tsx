// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import { CodeBlock } from '@/components/code-block';
import { cn } from '@/lib/utils';

interface PlanStep {
  step: number;
  description: string;
  file: string;
}
type AppStatus = 'idle' | 'planning' | 'review' | 'executing' | 'done';
type CopyStatus = 'idle' | 'copied';

export default function HomePage() {
  const [goal, setGoal] = useState<string>('');
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  // Multi-file final outputs
  const [finalFiles, setFinalFiles] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [openAccordion, setOpenAccordion] = useState<string>('');
  const [streamingPlan, setStreamingPlan] = useState<string>('');
  const [validationErrorIndex, setValidationErrorIndex] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'review') setOpenAccordion('item-plan');
    else if (status === 'executing') setOpenAccordion('item-log');
    else if (status === 'done') setOpenAccordion('item-code');
  }, [status]);

  const handleGeneratePlan = async () => {
    if (!goal.trim()) {
      toast.error('Goal cannot be empty.');
      return;
    }
    setStatus('planning');
    setPlan(null);
    setExecutionLogs([]);
    setFinalFiles({});
    setCopyStatus('idle');
    setOpenAccordion('');
    setStreamingPlan('');
    setValidationErrorIndex(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plan', payload: { goal } }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to start stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setStreamingPlan(fullResponse);
      }

      const planData = JSON.parse(fullResponse) as PlanStep[];
      setPlan(planData);
      setStatus('review');
    } catch (error) {
      toast.error('Error generating plan.', { description: (error as Error).message });
      setStatus('idle');
    }
  };

  // Multi-file execution engine with validation
  const handleExecutePlan = async () => {
    if (!plan) return;

    // Validate steps
    const invalidStepIndex = plan.findIndex(
      (step) => step.description.trim() === '' || step.file.trim() === ''
    );
    if (invalidStepIndex !== -1) {
      toast.error('Cannot execute plan.', {
        description: `Step ${invalidStepIndex + 1} has an empty description or file path.`,
      });
      setValidationErrorIndex(invalidStepIndex);
      setOpenAccordion('item-plan');
      return;
    }

    setValidationErrorIndex(null);
    setStatus('executing');
    setExecutionLogs([]);
    // Virtual file system for this run
    const virtualFileSystem: Record<string, string> = {};

    for (const step of plan) {
      try {
        setExecutionLogs((prev) => [
          ...prev,
          `Executing step ${step.step}: ${step.description}...`,
        ]);

        const fileContent = virtualFileSystem[step.file] || '';
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'execute',
            payload: {
              description: step.description,
              file: step.file,
              fileContent,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to execute step ${step.step}.`);
        }

        const data = await response.json();
        virtualFileSystem[step.file] = data.newCode;
        setExecutionLogs((prev) => [...prev, `Step ${step.step} (${step.file}) completed.`]);
      } catch (error) {
        const errorMessage = (error as Error).message;
        setExecutionLogs((prev) => [...prev, `Error on step ${step.step}: ${errorMessage}`]);
        toast.error('Execution failed.', { description: errorMessage });
        setStatus('review');
        return;
      }
    }

    setFinalFiles(virtualFileSystem);
    setExecutionLogs((prev) => [...prev, 'All steps executed! ✨']);
    setStatus('done');
    toast.success('Plan executed successfully!');
  };

  const handleCopyCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      toast.error('Failed to copy code.', { description: (error as Error).message });
    }
  };

  const handleReset = () => {
    setGoal('');
    setPlan(null);
    setStatus('idle');
    setExecutionLogs([]);
    setFinalFiles({});
    setCopyStatus('idle');
    setOpenAccordion('');
    setStreamingPlan('');
    setValidationErrorIndex(null);
  };

  // Editable plan helpers
  const handlePlanStepChange = (
    index: number,
    field: 'description' | 'file',
    value: string
  ) => {
    if (!plan) return;
    const updatedPlan = plan.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    setPlan(updatedPlan);
  };

  const handleDeleteStep = (index: number) => {
    if (!plan) return;
    const updated = plan.filter((_, i) => i !== index);
    const renumbered = updated.map((s, i) => ({ ...s, step: i + 1 }));
    setPlan(renumbered);
  };

  const handleAddStep = () => {
    if (!plan) return;
    const newStep: PlanStep = {
      step: plan.length + 1,
      description: '',
      file: plan[plan.length - 1]?.file || '',
    };
    setPlan([...plan, newStep]);
  };

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center text-center pt-12">
        <h1 className="text-4xl font-bold tracking-tight">CodePlanner Ai</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Your AI-powered planning layer for code generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Define Your Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g., Create a React component with a button that increments a counter."
              className="min-h-[120px] text-base"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={status !== 'idle'}
            />
            {status === 'idle' || status === 'planning' ? (
              <Button
                type="button"
                onClick={handleGeneratePlan}
                className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={status === 'planning'}
              >
                {status === 'planning' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  'Generate Plan'
                )}
              </Button>
            ) : (
              <Button type="button" onClick={handleReset} className="mt-4 w-full" variant="outline">
                Start Over
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Follow the Process</CardTitle>
          </CardHeader>
          <CardContent>
            {status === 'idle' && (
              <p className="text-muted-foreground">The generated plan will appear here.</p>
            )}

            {status === 'planning' && (
              <div className="text-sm font-mono bg-muted p-4 rounded-md whitespace-pre-wrap min-h-[5rem]">
                {streamingPlan || (
                  <span className="text-muted-foreground">Waiting for AI response...</span>
                )}
              </div>
            )}

            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={openAccordion}
              onValueChange={setOpenAccordion}
            >
              {plan && (
                <AccordionItem value="item-plan">
                  <AccordionTrigger>Generated Plan (Editable)</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-4 mb-4">
                      {plan.map((step, index) => (
                        <li key={index} className="p-3 bg-muted rounded-md space-y-2 relative">
                          <div className="flex items-center">
                            <span className="font-bold text-sm mr-2">Step {step.step}:</span>
                            <Input
                              type="text"
                              value={step.description}
                              placeholder="Enter step description..."
                              onChange={(e) =>
                                handlePlanStepChange(index, 'description', e.target.value)
                              }
                              className={cn(
                                'flex-grow',
                                validationErrorIndex === index &&
                                  step.description.trim() === '' &&
                                  'border-destructive focus-visible:ring-destructive'
                              )}
                              disabled={status === 'executing'}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 h-8 w-8"
                              onClick={() => handleDeleteStep(index)}
                              disabled={status === 'executing'}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="flex items-center pl-8">
                            <span className="text-sm text-muted-foreground mr-2">File:</span>
                            <Input
                              type="text"
                              value={step.file}
                              placeholder="path/to/file.ts"
                              onChange={(e) => handlePlanStepChange(index, 'file', e.target.value)}
                              className={cn(
                                'flex-grow',
                                validationErrorIndex === index &&
                                  step.file.trim() === '' &&
                                  'border-destructive focus-visible:ring-destructive'
                              )}
                              disabled={status === 'executing'}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddStep}
                      className="mb-4"
                      disabled={status === 'executing'}
                    >
                      + Add Step
                    </Button>

                    <div className="flex gap-4">
                      <Button
                        type="button"
                        onClick={handleExecutePlan}
                        className="w-full bg-green-600 text-white hover:bg-green-700"
                        disabled={status === 'executing' || plan.length === 0}
                      >
                        {status === 'executing' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executing...
                          </>
                        ) : (
                          'Approve & Execute'
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleReset}
                        className="w-full"
                        variant="destructive"
                        disabled={status === 'executing'}
                      >
                        Reject & Start Over
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {executionLogs.length > 0 && (
                <AccordionItem value="item-log">
                  <AccordionTrigger>Execution Log</AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm font-mono bg-muted p-2 rounded-md max-h-40 overflow-y-auto">
                      {executionLogs.map((log, i) => (
                        <p key={i}>{log}</p>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {Object.keys(finalFiles).length > 0 && (
                <AccordionItem value="item-code">
                  <AccordionTrigger>Final Code</AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue={Object.keys(finalFiles)[0]} className="w-full">
                      <TabsList>
                        {Object.keys(finalFiles).map((filename) => (
                          <TabsTrigger key={filename} value={filename}>
                            {filename}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {Object.entries(finalFiles).map(([filename, code]) => (
                        <TabsContent key={filename} value={filename}>
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-8 w-8 z-10 text-muted-foreground hover:bg-accent"
                              onClick={() => handleCopyCode(code)}
                            >
                              {copyStatus === 'copied' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                              <span className="sr-only">Copy code</span>
                            </Button>
                            <div className="text-sm rounded-md max-h-80 overflow-y-auto">
                              <CodeBlock code={code} />
                            </div>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
