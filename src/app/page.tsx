// src/app/page.tsx
'use client'; 

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  const [finalCode, setFinalCode] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [openAccordion, setOpenAccordion] = useState<string>("");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'review') {
      setOpenAccordion('item-plan');
    } else if (status === 'executing') {
      setOpenAccordion('item-log');
    } else if (status === 'done') {
      setOpenAccordion('item-code');
    }
  }, [status]);

  const handleGeneratePlan = async () => {
    if (!goal.trim()) {
      toast.error("Goal cannot be empty.");
      return;
    }
    setStatus('planning');
    setPlan(null);
    setExecutionLogs([]);
    setFinalCode('');
    setCopyStatus('idle');
    setOpenAccordion("");

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plan', payload: { goal } }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to generate plan.');
      }
      
      const data = await response.json();
      setPlan(data.plan);
      setStatus('review');
    } catch (error) {
      toast.error("Error generating plan.", { description: (error as Error).message });
      setStatus('idle');
    }
  };

  const handleExecutePlan = async () => {
    if (!plan) return;
    setStatus('executing');
    let currentFileContent = '';

    for (const step of plan) {
      try {
        setExecutionLogs(prev => [...prev, `Executing step ${step.step}: ${step.description}...`]);
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'execute',
            payload: {
              description: step.description,
              file: step.file,
              fileContent: currentFileContent,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to execute step ${step.step}.`);
        }
        
        const data = await response.json();
        currentFileContent = data.newCode;
        setExecutionLogs(prev => [...prev, `Step ${step.step} completed successfully.`]);

      } catch (error) {
        const errorMessage = (error as Error).message;
        setExecutionLogs(prev => [...prev, `Error on step ${step.step}: ${errorMessage}`]);
        toast.error("Execution failed.", { description: errorMessage });
        setStatus('review');
        return;
      }
    }
    
    setFinalCode(currentFileContent);
    setExecutionLogs(prev => [...prev, 'All steps executed! ✨']);
    setStatus('done');
    toast.success("Plan executed successfully!");
  };

  const handleCopyCode = async () => {
    if (!finalCode) return;
    try {
      await navigator.clipboard.writeText(finalCode);
      setCopyStatus('copied');
      toast.success("Code copied to clipboard!");
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      toast.error("Failed to copy code.", { description: (error as Error).message });
    }
  };

  const handleReset = () => {
    setGoal('');
    setPlan(null);
    setStatus('idle');
    setExecutionLogs([]);
    setFinalCode('');
    setCopyStatus('idle');
    setOpenAccordion("");
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight">CodePlanner AI</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Your AI-powered planning layer for code generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Left Column: Input and Control */}
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                ) : ( 'Generate Plan' )}
              </Button>
            ) : (
              <Button type="button" onClick={handleReset} className="mt-4 w-full" variant="outline">
                Start Over
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Right Column: Status and Output with Accordion */}
        <Card>
          <CardHeader>
            <CardTitle>2. Follow the Process</CardTitle>
          </CardHeader>
          <CardContent>
            {status === 'idle' && <p className="text-muted-foreground">The generated plan will appear here.</p>}
            {status === 'planning' && <div className="flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            
            <Accordion type="single" collapsible className="w-full" value={openAccordion} onValueChange={setOpenAccordion}>
              {plan && (
                <AccordionItem value="item-plan">
                  <AccordionTrigger>Generated Plan</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 mb-4">
                      {plan.map((step) => (
                        <li key={step.step} className="p-2 bg-muted rounded-md">
                          <span className="font-bold">Step {step.step}:</span> {step.description}
                          <p className="text-sm text-muted-foreground ml-6">File: {step.file}</p>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        onClick={handleExecutePlan}
                        className="w-full bg-green-600 text-white hover:bg-green-700"
                        disabled={status === 'executing'}
                      >
                         {status === 'executing' ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executing...</>
                        ) : ( 'Approve & Execute' )}
                      </Button>
                      <Button type="button" onClick={handleReset} className="w-full" variant="destructive" disabled={status === 'executing'}>
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
                      {executionLogs.map((log, i) => <p key={i}>{log}</p>)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {finalCode && (
                <AccordionItem value="item-code">
                  <AccordionTrigger>Final Code ({plan?.[0].file})</AccordionTrigger>
                  <AccordionContent>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:bg-accent"
                        onClick={handleCopyCode}
                      >
                        {copyStatus === 'copied' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        <span className="sr-only">Copy code</span>
                      </Button>
                      {mounted ? (
                        <SyntaxHighlighter
                          language="tsx"
                          style={resolvedTheme === 'dark' ? vscDarkPlus : vs}
                          className="text-sm rounded-md max-h-80 overflow-y-auto"
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            paddingRight: '3rem',
                          }}
                          codeTagProps={{
                            style: { fontFamily: 'var(--font-mono)' },
                          }}
                          wrapLongLines
                        >
                          {finalCode}
                        </SyntaxHighlighter>
                      ) : (
                        <pre className="text-sm bg-muted p-4 pr-12 rounded-md max-h-80 overflow-y-auto">
                          <code>{finalCode}</code>
                        </pre>
                      )}
                    </div>
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