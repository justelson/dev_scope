interface TreeNodeLike<TNode> {
    path: string
    type: 'file' | 'directory'
    children?: TNode[]
    childrenLoaded?: boolean
}

export function mergeDirectoryChildren<TNode extends TreeNodeLike<TNode>>(
    nodes: TNode[],
    targetPath: string,
    children: TNode[]
): TNode[] {
    let changed = false

    const visit = (items: TNode[]): TNode[] => {
        let localChanged = false

        const nextItems = items.map((node) => {
            if (node.type === 'directory' && node.path === targetPath) {
                localChanged = true
                changed = true
                return {
                    ...node,
                    children,
                    childrenLoaded: true
                }
            }

            if (node.type === 'directory' && node.children) {
                const nextChildren = visit(node.children)
                if (nextChildren !== node.children) {
                    localChanged = true
                    return {
                        ...node,
                        children: nextChildren
                    }
                }
            }

            return node
        })

        return localChanged ? nextItems : items
    }

    const nextNodes = visit(nodes)
    return changed ? nextNodes : nodes
}
