'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
} from '@/components/ui/glass-card';

export default function DemoPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Decorative background elements for glass effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">PostNet UI Components</h1>
          <p className="text-muted-foreground text-lg">
            shadcn/ui + Glassmorphism Design System
          </p>
        </div>

        {/* Section: Buttons */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <button className="btn-glass">Glass Button</button>
          </div>
        </section>

        {/* Section: Glass Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Glass Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassCard variant="default">
              <GlassCardHeader>
                <GlassCardTitle>Default Glass</GlassCardTitle>
                <GlassCardDescription>Standard glassmorphism</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
                <p className="text-sm">Beautiful frosted glass effect with blur and transparency.</p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard variant="subtle">
              <GlassCardHeader>
                <GlassCardTitle>Subtle Glass</GlassCardTitle>
                <GlassCardDescription>Light frosted effect</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
                <p className="text-sm">More transparent with subtle blur for layered UIs.</p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard variant="strong">
              <GlassCardHeader>
                <GlassCardTitle>Strong Glass</GlassCardTitle>
                <GlassCardDescription>More opaque effect</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
                <p className="text-sm">Higher opacity for better readability on busy backgrounds.</p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard variant="dark">
              <GlassCardHeader>
                <GlassCardTitle>Dark Glass</GlassCardTitle>
                <GlassCardDescription>Dark mode variant</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent>
                <p className="text-sm">Dark frosted glass for contrast on light backgrounds.</p>
              </GlassCardContent>
            </GlassCard>
          </div>
        </section>

        {/* Section: Standard Cards (shadcn) */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Standard Cards (shadcn/ui)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Overview</CardTitle>
                <CardDescription>Mailbox #142</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="default" className="bg-green-500">Active</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Renewal</span>
                    <span>Jan 15, 2025</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Contact preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms">SMS Alerts</Label>
                    <Switch id="sms" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email">Email Alerts</Label>
                    <Switch id="email" defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" size="sm">Renew Account</Button>
                <Button className="w-full" variant="outline" size="sm">View History</Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section: Form Elements */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Form Elements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Standard Form */}
            <Card>
              <CardHeader>
                <CardTitle>Standard Form</CardTitle>
                <CardDescription>shadcn/ui components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="terms" />
                  <Label htmlFor="terms" className="text-sm">Accept terms and conditions</Label>
                </div>
                <Button className="w-full">Submit</Button>
              </CardContent>
            </Card>

            {/* Glass Form */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle>Glass Form</GlassCardTitle>
                <GlassCardDescription>Glassmorphism styled</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name2">Full Name</Label>
                  <input
                    id="name2"
                    className="input-glass w-full"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <input
                    id="email2"
                    type="email"
                    className="input-glass w-full"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="terms2" />
                  <Label htmlFor="terms2" className="text-sm">Accept terms and conditions</Label>
                </div>
                <button className="btn-glass w-full">Submit</button>
              </GlassCardContent>
            </GlassCard>
          </div>
        </section>

        {/* Section: Badges */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Badges & Status</h2>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge className="bg-status-active text-white">Active</Badge>
            <Badge className="bg-status-due-soon text-white">Due Soon</Badge>
            <Badge className="bg-status-overdue text-white">Overdue</Badge>
            <Badge className="bg-status-hold text-white">On Hold</Badge>
            <Badge className="bg-status-closed text-white">Closed</Badge>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-primary" />
              <p className="text-sm font-medium">Primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-secondary border" />
              <p className="text-sm font-medium">Secondary</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-accent" />
              <p className="text-sm font-medium">Accent</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-muted" />
              <p className="text-sm font-medium">Muted</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-destructive" />
              <p className="text-sm font-medium">Destructive</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-postnet-red" />
              <p className="text-sm font-medium">PostNet Red</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
