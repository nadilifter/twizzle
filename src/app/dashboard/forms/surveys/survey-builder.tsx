"use client"

import * as React from "react"
import { Plus, Trash2, GripVertical } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type QuestionType = "text" | "multiple_choice" | "checkbox" | "rating"

interface Question {
  id: string
  text: string
  type: QuestionType
  options: string[]
  required: boolean
}

function SortableQuestion({
  question,
  index,
  updateQuestion,
  removeQuestion,
}: {
  question: Question
  index: number
  updateQuestion: (id: string, field: keyof Question, value: any) => void
  removeQuestion: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-2">
            <div
              {...attributes}
              {...listeners}
              className="mt-2 cursor-move text-muted-foreground"
            >
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor={`q-${question.id}-text`}>Question Text</Label>
                <Input
                  id={`q-${question.id}-text`}
                  value={question.text}
                  onChange={(e) =>
                    updateQuestion(question.id, "text", e.target.value)
                  }
                  placeholder="Enter your question here"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="grid gap-2 flex-1">
                  <Label htmlFor={`q-${question.id}-type`}>Type</Label>
                  <Select
                    value={question.type}
                    onValueChange={(value) =>
                      updateQuestion(question.id, "type", value)
                    }
                  >
                    <SelectTrigger id={`q-${question.id}-type`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Short Answer</SelectItem>
                      <SelectItem value="multiple_choice">
                        Multiple Choice
                      </SelectItem>
                      <SelectItem value="checkbox">Checkboxes</SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch
                    id={`q-${question.id}-required`}
                    checked={question.required}
                    onCheckedChange={(checked) =>
                      updateQuestion(question.id, "required", checked)
                    }
                  />
                  <Label htmlFor={`q-${question.id}-required`}>Required</Label>
                </div>
              </div>

              {(question.type === "multiple_choice" ||
                question.type === "checkbox") && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...question.options]
                          newOptions[optIndex] = e.target.value
                          updateQuestion(question.id, "options", newOptions)
                        }}
                        placeholder={`Option ${optIndex + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newOptions = question.options.filter(
                            (_, i) => i !== optIndex
                          )
                          updateQuestion(question.id, "options", newOptions)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateQuestion(question.id, "options", [
                        ...question.options,
                        "",
                      ])
                    }
                  >
                    Add Option
                  </Button>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => removeQuestion(question.id)}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function SurveyBuilder() {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [questions, setQuestions] = React.useState<Question[]>([
    {
      id: "1",
      text: "",
      type: "text",
      options: [],
      required: false,
    },
  ])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const addQuestion = () => {
    const newId = Math.random().toString(36).substr(2, 9)
    setQuestions([
      ...questions,
      {
        id: newId,
        text: "",
        type: "text",
        options: [],
        required: false,
      },
    ])
  }

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    )
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="survey-title" className="text-lg font-semibold">
            Survey Title
          </Label>
          <Input
            id="survey-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., End of Season Feedback"
            className="text-lg"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="survey-desc">Description</Label>
          <Textarea
            id="survey-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this survey is for..."
          />
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Questions</h2>
          <Button onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" /> Add Question
          </Button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {questions.map((question, index) => (
              <SortableQuestion
                key={question.id}
                question={question}
                index={index}
                updateQuestion={updateQuestion}
                removeQuestion={removeQuestion}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button onClick={() => alert("Survey saved! (Mock action)")}>
          Save Survey
        </Button>
      </div>
    </div>
  )
}












