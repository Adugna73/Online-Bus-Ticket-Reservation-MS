import { z } from "zod";

export const technicianSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  username: z.string().min(1, "Username is required"),
  staffId: z.string().optional(),
  phone: z.string().optional(),
});

export type TechnicianForm = z.infer<typeof technicianSchema>;
