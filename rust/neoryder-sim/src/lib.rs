use std::collections::{HashMap, VecDeque};
use wasm_bindgen::prelude::*;

const NONE: u32 = u32::MAX;
const FIELD_LIMIT: usize = 32;

#[wasm_bindgen]
pub struct SimGraph {
    offsets: Vec<u32>,
    edges: Vec<u32>,
    fields: HashMap<u32, Vec<u32>>,
    order: VecDeque<u32>,
}

#[wasm_bindgen]
impl SimGraph {
    #[wasm_bindgen(constructor)]
    pub fn new(offsets: &[u32], edges: &[u32]) -> Self {
        Self {
            offsets: offsets.to_vec(),
            edges: edges.to_vec(),
            fields: HashMap::new(),
            order: VecDeque::new(),
        }
    }

    /// Output: n rows of route prefixes, n+1 absolute neighbor offsets, then spawn indices.
    pub fn frame(
        &mut self,
        pairs: &[u32],
        positions: &[f32],
        radius: f64,
        depth: usize,
    ) -> Vec<u32> {
        let n = positions.len() / 2;
        let nodes = self.offsets.len().saturating_sub(1) as u32;
        let mut out = vec![NONE; n * depth + n + 1];
        for (i, pair) in pairs.chunks_exact(2).enumerate().take(n) {
            let (mut node, goal) = (pair[0], pair[1]);
            if node >= nodes || goal >= nodes {
                continue;
            }
            self.prepare(goal);
            let field = &self.fields[&goal];
            for dest in &mut out[i * depth..(i + 1) * depth] {
                node = field[node as usize];
                if node == NONE {
                    break;
                }
                *dest = node;
                if node == goal {
                    break;
                }
            }
        }
        let head = n * depth;
        for (i, p) in positions.chunks_exact(2).enumerate() {
            out[head + i] = out.len() as u32;
            for (j, q) in positions.chunks_exact(2).enumerate() {
                if i != j
                    && (f64::from(p[0]) - f64::from(q[0])).abs() <= radius
                    && (f64::from(p[1]) - f64::from(q[1])).abs() <= radius
                {
                    out.push(j as u32);
                }
            }
        }
        out[head + n] = out.len() as u32;
        out
    }
}

impl SimGraph {
    fn neighbors(&self, node: usize) -> &[u32] {
        &self.edges[self.offsets[node] as usize..self.offsets[node + 1] as usize]
    }

    fn prepare(&mut self, goal: u32) {
        if self.fields.contains_key(&goal) {
            return;
        }
        let mut distance = vec![NONE; self.offsets.len() - 1];
        let mut queue = VecDeque::from([goal]);
        distance[goal as usize] = 0;
        while let Some(node) = queue.pop_front() {
            for &next in self.neighbors(node as usize) {
                if distance[next as usize] == NONE {
                    distance[next as usize] = distance[node as usize] + 1;
                    queue.push_back(next);
                }
            }
        }
        let mut flow = vec![NONE; distance.len()];
        flow[goal as usize] = goal;
        for (i, &d) in distance.iter().enumerate() {
            if d != NONE && d > 0 {
                flow[i] = self
                    .neighbors(i)
                    .iter()
                    .copied()
                    .find(|&j| distance[j as usize] == d - 1)
                    .unwrap_or(NONE);
            }
        }
        if self.order.len() == FIELD_LIMIT {
            self.fields.remove(&self.order.pop_front().unwrap());
        }
        self.order.push_back(goal);
        self.fields.insert(goal, flow);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn out_of_range_cells_and_empty_graph_are_ignored() {
        let mut graph = SimGraph::new(&[0, 1, 2], &[1, 0]);
        let result = graph.frame(&[0, 7, 9, 1, NONE, 0], &[0., 0., 1., 0., 2., 0.], 1., 1);
        assert_eq!(&result[..3], &[NONE, NONE, NONE]);
        let mut empty = SimGraph::new(&[], &[]);
        assert_eq!(empty.frame(&[0, 0], &[0., 0.], 1., 1), [NONE, 3, 3]);
    }

    #[test]
    fn ordered_ties_unreachable_and_neighbors() {
        let mut graph = SimGraph::new(&[0, 2, 4, 6, 8, 8], &[2, 1, 0, 3, 0, 3, 1, 2]);
        let result = graph.frame(&[0, 3, 4, 3, 3, 3], &[0., 0., 1., 0., 4., 0.], 1., 2);
        assert_eq!(result, [2, 3, NONE, NONE, 3, NONE, 10, 11, 12, 12, 1, 0]);
    }
}
