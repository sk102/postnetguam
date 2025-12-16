import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import {
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_CATEGORY_LABELS,
} from '@/constants/notice';

/**
 * GET /api/notices/variables - Get all available template variables
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Group variables by category
    const variablesByCategory: Record<
      string,
      Array<{
        name: string;
        description: string;
        example: string;
      }>
    > = {};

    for (const variable of TEMPLATE_VARIABLES) {
      const categoryLabel =
        TEMPLATE_VARIABLE_CATEGORY_LABELS[variable.category];
      if (!variablesByCategory[categoryLabel]) {
        variablesByCategory[categoryLabel] = [];
      }
      variablesByCategory[categoryLabel].push({
        name: variable.name,
        description: variable.description,
        example: variable.example,
      });
    }

    return NextResponse.json({
      variables: TEMPLATE_VARIABLES,
      variablesByCategory,
      categories: TEMPLATE_VARIABLE_CATEGORY_LABELS,
    });
  } catch (error) {
    console.error('Get variables API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
